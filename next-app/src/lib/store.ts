import { nanoid } from "nanoid";
import { accessKeysMatch, hashAccessKey, newAccessKey, newToken } from "./auth";
import { sql, withTx, type Query } from "./db";
import {
  EVENT_TTL_MS,
  MAX_EVENT_UPLOAD_CHARS,
  MAX_EVENTS_GLOBAL,
  MAX_GUESTS_PER_EVENT,
  MAX_MISSIONS,
  MAX_PHOTO_CHARS,
  MAX_REF_PHOTO_CHARS,
  MAX_SUBMISSIONS_PER_EVENT,
  MIN_MISSIONS,
} from "./limits";
import { assertJpegDataUrl } from "./photo";
import type {
  GuestState,
  HostState,
  HuntEvent,
  Mission,
  PollState,
  ScreenState,
  SubmissionStatus,
} from "./types";

type EventRow = { id: string; data: HuntEvent | string };

function parseEvent(row: EventRow): HuntEvent {
  const data = typeof row.data === "string" ? (JSON.parse(row.data) as HuntEvent) : row.data;
  return data;
}

/* ---------- images (photos, references, logo) ---------- */

/** Stored image fields hold either `img:<id>` (images table) or a legacy inline data-URL. */
const IMG_PREFIX = "img:";

/** What the browser gets: a short cacheable URL instead of hundreds of KB per poll. */
function imgSrc(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith(IMG_PREFIX)) return `/api/img/${ref.slice(IMG_PREFIX.length)}`;
  return ref;
}

/** `/api/img/<id>` coming back from the client → our stored ref. */
function refFromSrc(value: string): string | null {
  const m = /^\/api\/img\/([A-Za-z0-9_-]{16})$/.exec(value);
  return m ? `${IMG_PREFIX}${m[1]}` : null;
}

async function putImage(q: Query, eventId: string, dataUrl: string): Promise<string> {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("Только JPEG data-URL");
  const id = nanoid(16);
  await q("insert into images (id, event_id, data) values ($1, $2, $3)", [id, eventId, Buffer.from(m[1], "base64")]);
  return `${IMG_PREFIX}${id}`;
}

async function dropImage(q: Query, ref: string | undefined) {
  if (ref?.startsWith(IMG_PREFIX)) await q("delete from images where id = $1", [ref.slice(IMG_PREFIX.length)]);
}

export async function loadImage(id: string): Promise<Uint8Array | null> {
  if (!/^[A-Za-z0-9_-]{16}$/.test(id)) return null;
  const rows = await sql<{ data: Uint8Array }>("select data from images where id = $1", [id]);
  return rows[0]?.data ?? null;
}

/* ---------- events ---------- */

export async function countEvents(q: Query = sql) {
  const rows = await q<{ c: string }>("select count(*)::text as c from events");
  return Number(rows[0]?.c ?? 0);
}

export async function loadEvent(id: string): Promise<HuntEvent | null> {
  const rows = await sql<EventRow>("select id, data from events where id = $1", [id]);
  if (!rows[0]) return null;
  return parseEvent(rows[0]);
}

export async function saveEvent(event: HuntEvent, q: Query = sql) {
  event.updatedAt = Date.now();
  await q(
    `insert into events (id, data, updated_at)
     values ($1, $2::jsonb, NOW())
     on conflict (id) do update set data = excluded.data, updated_at = NOW()`,
    [event.id, JSON.stringify(event)],
  );
}

/** Load → change → save under a row lock, so simultaneous uploads never overwrite each other. */
async function mutateEvent<T>(id: string, change: (event: HuntEvent, q: Query) => Promise<T> | T): Promise<T> {
  return withTx(async (q) => {
    const rows = await q<EventRow>("select id, data from events where id = $1 for update", [id]);
    if (!rows[0]) throw new Error("Событие не найдено");
    const event = parseEvent(rows[0]);
    const result = await change(event, q);
    await saveEvent(event, q);
    return result;
  });
}

/** Old hunts and their photos are removed automatically, so the server never fills up. */
export async function pruneOldEvents() {
  await sql("delete from events where updated_at < NOW() - ($1::bigint * interval '1 millisecond')", [EVENT_TTL_MS]);
  await sql("delete from images where event_id not in (select id from events)");
}

const DEFAULT_MISSIONS: string[] = [
  "Селфи с коллегой из другого отдела",
  "Найди что-то зелёное и сфотографируй",
  "Самая смешная поза с другом",
  "Кадр с логотипом компании",
  "Фото «мы уже легенды»",
];

type MissionDraft = { id: string; text: string; refPhoto?: string };

/** Validates mission text; reference photos stay as data-URL / `/api/img/` until stored. */
function normalizeMissionDrafts(input: unknown): MissionDraft[] {
  if (!Array.isArray(input) || input.length !== MIN_MISSIONS) {
    throw new Error(`Нужно ровно ${MIN_MISSIONS} миссий`);
  }
  const missions: MissionDraft[] = [];
  for (const raw of input) {
    const item = raw as { id?: string; text?: string; refPhoto?: string };
    const text = String(item.text ?? "").trim();
    if (text.length < 3 || text.length > 160) {
      throw new Error("Текст миссии: 3–160 символов");
    }
    let refPhoto: string | undefined;
    if (item.refPhoto) {
      const kept = refFromSrc(String(item.refPhoto));
      if (kept) refPhoto = kept;
      else {
        assertJpegDataUrl(item.refPhoto, MAX_REF_PHOTO_CHARS);
        refPhoto = item.refPhoto;
      }
    }
    missions.push({ id: String(item.id || "").slice(0, 24) || nanoid(10), text, refPhoto });
  }
  if (missions.length > MAX_MISSIONS) throw new Error("Слишком много миссий");
  return missions;
}

/** Store new data-URL references in the images table. Returns missions + bytes added. */
async function storeMissionRefs(q: Query, eventId: string, drafts: MissionDraft[]) {
  let added = 0;
  const missions: Mission[] = [];
  for (const d of drafts) {
    let refPhoto = d.refPhoto;
    if (refPhoto && refPhoto.startsWith("data:")) {
      added += refPhoto.length;
      refPhoto = await putImage(q, eventId, refPhoto);
    }
    missions.push({ id: d.id, text: d.text, refPhoto });
  }
  return { missions, added };
}

export async function createEvent(input: {
  title: string;
  missions: unknown;
  companyLogo?: string;
}): Promise<{ event: HuntEvent; hostToken: string }> {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 80) throw new Error("Название: 2–80 символов");

  const drafts = normalizeMissionDrafts(input.missions);
  if (input.companyLogo) assertJpegDataUrl(input.companyLogo, MAX_REF_PHOTO_CHARS);

  await pruneOldEvents();

  return withTx(async (q) => {
    if ((await countEvents(q)) >= MAX_EVENTS_GLOBAL) {
      throw new Error("Лимит событий на сервере");
    }
    const id = nanoid(12);
    const { missions, added } = await storeMissionRefs(q, id, drafts);
    const companyLogo = input.companyLogo ? await putImage(q, id, input.companyLogo) : undefined;

    const hostToken = newToken(24);
    // Kept for compatibility with older screens; guests no longer type a key.
    const guestAccessKey = newAccessKey(4);
    const now = Date.now();
    const event: HuntEvent = {
      id,
      title,
      companyLogo,
      hostToken,
      guestAccessKey,
      guestAccessKeyHash: hashAccessKey(guestAccessKey),
      screenToken: newToken(18),
      status: "live",
      missions,
      guests: [],
      submissions: [],
      uploadBytesUsed: added + (input.companyLogo?.length ?? 0),
      createdAt: now,
      updatedAt: now,
    };
    await saveEvent(event, q);
    return { event, hostToken };
  });
}

export function defaultMissionDrafts() {
  return DEFAULT_MISSIONS.map((text) => ({ id: nanoid(8), text, refPhoto: "" }));
}

function guestNameById(event: HuntEvent, guestId: string) {
  return event.guests.find((g) => g.id === guestId)?.name ?? "Гость";
}

function missionTextById(event: HuntEvent, missionId: string) {
  return event.missions.find((m) => m.id === missionId)?.text ?? "Миссия";
}

function publicMissions(event: HuntEvent) {
  return event.missions.map((m) => ({ id: m.id, text: m.text, refPhoto: imgSrc(m.refPhoto) }));
}

export function toHostState(event: HuntEvent): HostState {
  return {
    role: "host",
    eventId: event.id,
    title: event.title,
    companyLogo: imgSrc(event.companyLogo),
    status: event.status,
    guestAccessKey: event.guestAccessKey,
    screenToken: event.screenToken,
    missions: publicMissions(event),
    guestCount: event.guests.length,
    uploadBytesUsed: event.uploadBytesUsed,
    uploadQuotaBytes: MAX_EVENT_UPLOAD_CHARS,
    submissions: [...event.submissions]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        ...s,
        photo: imgSrc(s.photo) ?? "",
        guestName: guestNameById(event, s.guestId),
        missionText: missionTextById(event, s.missionId),
      })),
  };
}

export function toGuestState(event: HuntEvent, guestToken: string): GuestState | null {
  const guest = event.guests.find((g) => g.guestToken === guestToken);
  if (!guest) return null;
  return {
    role: "guest",
    eventId: event.id,
    title: event.title,
    companyLogo: imgSrc(event.companyLogo),
    status: event.status,
    guestId: guest.id,
    name: guest.name,
    missions: publicMissions(event),
    mySubmissions: event.submissions
      .filter((s) => s.guestId === guest.id)
      .map((s) => ({
        id: s.id,
        missionId: s.missionId,
        status: s.status,
        photo: imgSrc(s.photo) ?? "",
      })),
  };
}

export function toScreenState(event: HuntEvent): ScreenState {
  const live = event.submissions
    .filter((s) => s.status === "approved")
    .sort((a, b) => b.createdAt - a.createdAt);
  const rubrics = event.missions.map((m, i) => ({
    id: m.id,
    index: i + 1,
    text: m.text,
    photos: live
      .filter((s) => s.missionId === m.id)
      .map((s) => ({
        id: s.id,
        photo: imgSrc(s.photo) ?? "",
        guestName: guestNameById(event, s.guestId),
        missionId: m.id,
        missionText: m.text,
        createdAt: s.createdAt,
      })),
  }));
  return {
    role: "screen",
    eventId: event.id,
    title: event.title,
    companyLogo: imgSrc(event.companyLogo),
    status: event.status,
    guestCount: event.guests.length,
    guestAccessKey: event.guestAccessKey,
    joinPath: `/join/${event.id}`,
    photoCount: live.length,
    rubrics,
  };
}

export function resolveState(event: HuntEvent, token: string): PollState | null {
  if (token === event.hostToken) return toHostState(event);
  if (token === event.screenToken) return toScreenState(event);
  return toGuestState(event, token);
}

/** Guests join straight from the QR link: only a name is needed, no key. */
export async function joinGuest(eventId: string, nameRaw: string) {
  const name = nameRaw.trim();
  if (name.length < 2 || name.length > 40) throw new Error("Имя: 2–40 символов");
  return mutateEvent(eventId, (event) => {
    if (event.status === "closed") throw new Error("Охота закрыта");
    if (event.guests.length >= MAX_GUESTS_PER_EVENT) throw new Error("Лимит гостей");
    const guestToken = newToken(20);
    const guest = {
      id: nanoid(10),
      guestToken,
      name,
      createdAt: Date.now(),
    };
    event.guests.push(guest);
    return { guestToken, guestId: guest.id, state: toGuestState(event, guestToken)! };
  });
}

export async function submitPhoto(
  eventId: string,
  guestToken: string,
  missionId: string,
  photo: string,
) {
  assertJpegDataUrl(photo, MAX_PHOTO_CHARS);
  return mutateEvent(eventId, async (event, q) => {
    if (event.status !== "live") throw new Error("Сейчас нельзя загружать");
    const guest = event.guests.find((g) => g.guestToken === guestToken);
    if (!guest) throw new Error("Нужна авторизация гостя");
    const mission = event.missions.find((m) => m.id === missionId);
    if (!mission) throw new Error("Миссия не найдена");
    if (event.submissions.length >= MAX_SUBMISSIONS_PER_EVENT) {
      throw new Error("Лимит фото на событие");
    }
    if (event.uploadBytesUsed + photo.length > MAX_EVENT_UPLOAD_CHARS) {
      throw new Error("Квота хранилища события исчерпана");
    }

    const existing = event.submissions.find(
      (s) => s.guestId === guest.id && s.missionId === missionId && s.status !== "rejected",
    );
    if (existing) throw new Error("Уже есть фото по этой миссии");

    // No host moderation — shot goes straight to the hall screen.
    const submission = {
      id: nanoid(12),
      guestId: guest.id,
      missionId,
      photo: await putImage(q, event.id, photo),
      status: "approved" as const,
      createdAt: Date.now(),
    };
    event.submissions.push(submission);
    event.uploadBytesUsed += photo.length;
    return toGuestState(event, guestToken)!;
  });
}

export async function moderateSubmission(
  eventId: string,
  hostToken: string,
  submissionId: string,
  status: SubmissionStatus,
) {
  if (status !== "approved" && status !== "rejected") {
    throw new Error("Статус: approved или rejected");
  }
  return mutateEvent(eventId, (event) => {
    if (event.hostToken !== hostToken) throw new Error("Нет доступа ведущего");
    const sub = event.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new Error("Фото не найдено");
    sub.status = status;
    return toHostState(event);
  });
}

export async function updateHostEvent(
  eventId: string,
  hostToken: string,
  patch: { title?: string; missions?: unknown; status?: HuntEvent["status"]; companyLogo?: string | null },
) {
  const drafts = patch.missions ? normalizeMissionDrafts(patch.missions) : null;
  return mutateEvent(eventId, async (event, q) => {
    if (event.hostToken !== hostToken) throw new Error("Нет доступа ведущего");

    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (title.length < 2 || title.length > 80) throw new Error("Название: 2–80 символов");
      event.title = title;
    }
    if (patch.status) event.status = patch.status;
    if (drafts) {
      const { missions, added } = await storeMissionRefs(q, event.id, drafts);
      const keep = new Set(missions.map((m) => m.refPhoto));
      for (const m of event.missions) if (!keep.has(m.refPhoto)) await dropImage(q, m.refPhoto);
      event.missions = missions;
      event.uploadBytesUsed += added;
    }
    if (patch.companyLogo !== undefined) {
      if (patch.companyLogo === null || patch.companyLogo === "") {
        await dropImage(q, event.companyLogo);
        event.companyLogo = undefined;
      } else if (!refFromSrc(patch.companyLogo)) {
        assertJpegDataUrl(patch.companyLogo, MAX_REF_PHOTO_CHARS);
        await dropImage(q, event.companyLogo);
        event.companyLogo = await putImage(q, event.id, patch.companyLogo);
        event.uploadBytesUsed += patch.companyLogo.length;
      }
    }
    return toHostState(event);
  });
}

/** Minimal meta only after a valid guest access key (no open read-by-id). */
export function gatedEventMeta(event: HuntEvent) {
  return {
    id: event.id,
    title: event.title,
    status: event.status,
    missionCount: event.missions.length,
  };
}

export function assertGuestAccess(event: HuntEvent, accessKey: string) {
  if (!accessKeysMatch(accessKey, event.guestAccessKey, event.guestAccessKeyHash)) {
    throw new Error("Неверный ключ события");
  }
}
