import { nanoid } from "nanoid";
import { accessKeysMatch, hashAccessKey, newAccessKey, newToken } from "./auth";
import { sql } from "./db";
import {
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

export async function countEvents() {
  const rows = await sql<{ c: string }>("select count(*)::text as c from events");
  return Number(rows[0]?.c ?? 0);
}

export async function loadEvent(id: string): Promise<HuntEvent | null> {
  const rows = await sql<EventRow>("select id, data from events where id = $1", [id]);
  if (!rows[0]) return null;
  return parseEvent(rows[0]);
}

export async function saveEvent(event: HuntEvent) {
  event.updatedAt = Date.now();
  await sql(
    `insert into events (id, data, updated_at)
     values ($1, $2::jsonb, NOW())
     on conflict (id) do update set data = excluded.data, updated_at = NOW()`,
    [event.id, JSON.stringify(event)],
  );
}

const DEFAULT_MISSIONS: string[] = [
  "Селфи с коллегой из другого отдела",
  "Найди что-то зелёное и сфотографируй",
  "Самая смешная поза с другом",
  "Кадр с логотипом компании",
  "Фото «мы уже легенды»",
];

export function normalizeMissions(input: unknown): Mission[] {
  if (!Array.isArray(input) || input.length !== MIN_MISSIONS) {
    throw new Error(`Нужно ровно ${MIN_MISSIONS} миссий`);
  }
  const missions: Mission[] = [];
  for (const raw of input) {
    const item = raw as { id?: string; text?: string; refPhoto?: string };
    const text = String(item.text ?? "").trim();
    if (text.length < 3 || text.length > 160) {
      throw new Error("Текст миссии: 3–160 символов");
    }
    let refPhoto: string | undefined;
    if (item.refPhoto) {
      assertJpegDataUrl(item.refPhoto, MAX_REF_PHOTO_CHARS);
      refPhoto = item.refPhoto;
    }
    missions.push({ id: item.id || nanoid(10), text, refPhoto });
  }
  if (missions.length > MAX_MISSIONS) throw new Error("Слишком много миссий");
  return missions;
}

export async function createEvent(input: {
  title: string;
  missions: unknown;
  companyLogo?: string;
}): Promise<{ event: HuntEvent; hostToken: string }> {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 80) throw new Error("Название: 2–80 символов");
  if ((await countEvents()) >= MAX_EVENTS_GLOBAL) {
    throw new Error("Лимит событий на сервере");
  }

  const missions = normalizeMissions(input.missions);
  let companyLogo: string | undefined;
  if (input.companyLogo) {
    assertJpegDataUrl(input.companyLogo, MAX_REF_PHOTO_CHARS);
    companyLogo = input.companyLogo;
  }

  const hostToken = newToken(24);
  const guestAccessKey = newAccessKey(12);
  const now = Date.now();
  const event: HuntEvent = {
    id: nanoid(12),
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
    uploadBytesUsed: (companyLogo?.length ?? 0) + missions.reduce((s, m) => s + (m.refPhoto?.length ?? 0), 0),
    createdAt: now,
    updatedAt: now,
  };
  await saveEvent(event);
  return { event, hostToken };
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

export function toHostState(event: HuntEvent): HostState {
  return {
    role: "host",
    eventId: event.id,
    title: event.title,
    companyLogo: event.companyLogo,
    status: event.status,
    guestAccessKey: event.guestAccessKey,
    screenToken: event.screenToken,
    missions: event.missions.map((m) => ({
      id: m.id,
      text: m.text,
      refPhoto: m.refPhoto,
    })),
    guestCount: event.guests.length,
    uploadBytesUsed: event.uploadBytesUsed,
    uploadQuotaBytes: MAX_EVENT_UPLOAD_CHARS,
    submissions: [...event.submissions]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        ...s,
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
    companyLogo: event.companyLogo,
    status: event.status,
    guestId: guest.id,
    name: guest.name,
    missions: event.missions.map((m) => ({
      id: m.id,
      text: m.text,
      refPhoto: m.refPhoto,
    })),
    mySubmissions: event.submissions
      .filter((s) => s.guestId === guest.id)
      .map((s) => ({
        id: s.id,
        missionId: s.missionId,
        status: s.status,
        photo: s.photo,
      })),
  };
}

export function toScreenState(event: HuntEvent): ScreenState {
  return {
    role: "screen",
    eventId: event.id,
    title: event.title,
    companyLogo: event.companyLogo,
    status: event.status,
    guestCount: event.guests.length,
    joinPath: `/join/${event.id}`,
    approved: event.submissions
      .filter((s) => s.status === "approved")
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        id: s.id,
        photo: s.photo,
        guestName: guestNameById(event, s.guestId),
        missionText: missionTextById(event, s.missionId),
        createdAt: s.createdAt,
      })),
  };
}

export function resolveState(event: HuntEvent, token: string): PollState | null {
  if (token === event.hostToken) return toHostState(event);
  if (token === event.screenToken) return toScreenState(event);
  return toGuestState(event, token);
}

export async function joinGuest(eventId: string, accessKey: string, nameRaw: string) {
  const event = await loadEvent(eventId);
  if (!event) throw new Error("Событие не найдено");
  if (event.status === "closed") throw new Error("Охота закрыта");
  if (!accessKeysMatch(accessKey, event.guestAccessKey, event.guestAccessKeyHash)) {
    throw new Error("Неверный ключ события");
  }
  const name = nameRaw.trim();
  if (name.length < 2 || name.length > 40) throw new Error("Имя: 2–40 символов");
  if (event.guests.length >= MAX_GUESTS_PER_EVENT) throw new Error("Лимит гостей");

  const guestToken = newToken(20);
  const guest = {
    id: nanoid(10),
    guestToken,
    name,
    createdAt: Date.now(),
  };
  event.guests.push(guest);
  await saveEvent(event);
  return { guestToken, guestId: guest.id, state: toGuestState(event, guestToken)! };
}

export async function submitPhoto(
  eventId: string,
  guestToken: string,
  missionId: string,
  photo: string,
) {
  const event = await loadEvent(eventId);
  if (!event) throw new Error("Событие не найдено");
  if (event.status !== "live") throw new Error("Сейчас нельзя загружать");
  const guest = event.guests.find((g) => g.guestToken === guestToken);
  if (!guest) throw new Error("Нужна авторизация гостя");
  const mission = event.missions.find((m) => m.id === missionId);
  if (!mission) throw new Error("Миссия не найдена");
  assertJpegDataUrl(photo, MAX_PHOTO_CHARS);
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

  const submission = {
    id: nanoid(12),
    guestId: guest.id,
    missionId,
    photo,
    status: "pending" as const,
    createdAt: Date.now(),
  };
  event.submissions.push(submission);
  event.uploadBytesUsed += photo.length;
  await saveEvent(event);
  return toGuestState(event, guestToken)!;
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
  const event = await loadEvent(eventId);
  if (!event) throw new Error("Событие не найдено");
  if (event.hostToken !== hostToken) throw new Error("Нет доступа ведущего");
  const sub = event.submissions.find((s) => s.id === submissionId);
  if (!sub) throw new Error("Фото не найдено");
  sub.status = status;
  await saveEvent(event);
  return toHostState(event);
}

export async function updateHostEvent(
  eventId: string,
  hostToken: string,
  patch: { title?: string; missions?: unknown; status?: HuntEvent["status"]; companyLogo?: string | null },
) {
  const event = await loadEvent(eventId);
  if (!event) throw new Error("Событие не найдено");
  if (event.hostToken !== hostToken) throw new Error("Нет доступа ведущего");

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (title.length < 2 || title.length > 80) throw new Error("Название: 2–80 символов");
    event.title = title;
  }
  if (patch.status) event.status = patch.status;
  if (patch.missions) {
    const oldRefs = event.missions.reduce((s, m) => s + (m.refPhoto?.length ?? 0), 0);
    event.missions = normalizeMissions(patch.missions);
    const newRefs = event.missions.reduce((s, m) => s + (m.refPhoto?.length ?? 0), 0);
    event.uploadBytesUsed = Math.max(0, event.uploadBytesUsed - oldRefs + newRefs);
  }
  if (patch.companyLogo !== undefined) {
    const old = event.companyLogo?.length ?? 0;
    if (patch.companyLogo === null || patch.companyLogo === "") {
      event.companyLogo = undefined;
      event.uploadBytesUsed = Math.max(0, event.uploadBytesUsed - old);
    } else {
      assertJpegDataUrl(patch.companyLogo, MAX_REF_PHOTO_CHARS);
      event.companyLogo = patch.companyLogo;
      event.uploadBytesUsed = Math.max(0, event.uploadBytesUsed - old + patch.companyLogo.length);
    }
  }
  await saveEvent(event);
  return toHostState(event);
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
