"use client";

import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { QrPopup } from "@/components/QrPopup";
import { usePollState } from "@/hooks/usePollState";
import { api } from "@/lib/apiClient";
import { loadToken, persistToken, readHashParam } from "@/lib/sessionKeys";
import type { ScreenShot, ScreenState } from "@/lib/types";

/** Smallest photo tile we allow before splitting a rubric into pages. */
const MIN_TILE = 180;
const GAP = 12;
/** How long each page stays on the hall screen when a rubric has too many photos. */
const PAGE_MS = 9000;
/** A fresh photo glows this long after it first appears. */
const FRESH_MS = 6000;
const IDLE_CURSOR_MS = 2500;

type View = "auto" | "stars" | string; // string = rubric id

function resolveScreenToken(eventId: string) {
  const fromHash = readHashParam("s");
  if (fromHash) {
    persistToken("screen", eventId, fromHash);
    return fromHash;
  }
  return loadToken("screen", eventId);
}

/** Best square-tile grid for n photos inside w×h: as large as possible, everything visible. */
function fitGrid(n: number, w: number, h: number) {
  let best = { cols: 1, rows: 1, size: 0 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.floor(Math.min((w - GAP * (cols - 1)) / cols, (h - GAP * (rows - 1)) / rows));
    if (size > best.size) best = { cols, rows, size };
  }
  return best;
}

/** How many photos fit on one screen while each stays at least MIN_TILE. */
function capacity(w: number, h: number) {
  const cols = Math.max(1, Math.floor((w + GAP) / (MIN_TILE + GAP)));
  const rows = Math.max(1, Math.floor((h + GAP) / (MIN_TILE + GAP)));
  return cols * rows;
}

function sortShots(list: ScreenShot[]) {
  return [...list].sort((a, b) => Number(b.starred) - Number(a.starred) || b.createdAt - a.createdAt);
}

export function ScreenInner() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [paste, setPaste] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [view, setView] = useState<View>("auto");
  const [page, setPage] = useState(0);
  const [armed, setArmed] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [, setTick] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const firstSeen = useRef(new Map<string, number>());
  const bootedAt = useRef(0);
  const { state, error, loading, setState } = usePollState(eventId, token || undefined);
  const screen = state?.role === "screen" ? (state as ScreenState) : null;

  useLayoutEffect(() => {
    const next = resolveScreenToken(eventId);
    if (readHashParam("s")) {
      window.history.replaceState(null, "", `/screen/${eventId}`);
    }
    setToken(next);
    setOrigin(window.location.origin);
    setReady(true);
    bootedAt.current = Date.now();
  }, [eventId]);

  const joinUrl = useMemo(() => (origin ? `${origin}/join/${eventId}` : ""), [origin, eventId]);

  const allShots = useMemo(() => screen?.rubrics.flatMap((r) => r.photos) ?? [], [screen]);
  const starred = useMemo(() => sortShots(allShots.filter((s) => s.starred)), [allShots]);
  const newest = useMemo(
    () => allShots.reduce<ScreenShot | null>((a, s) => (!a || s.createdAt > a.createdAt ? s : a), null),
    [allShots],
  );

  // Remember when each photo first showed up, so new ones can glow for a moment.
  const now = Date.now();
  for (const s of allShots) {
    if (!firstSeen.current.has(s.id)) {
      // Photos already there when the screen opened don't glow.
      firstSeen.current.set(s.id, now - bootedAt.current < 3000 ? 0 : now);
    }
  }
  const isFresh = (id: string) => now - (firstSeen.current.get(id) ?? 0) < FRESH_MS;

  // "Авто": always show the rubric that got the latest photo.
  const autoRubricId = newest?.missionId ?? screen?.rubrics[0]?.id ?? "";
  const activeRubric =
    view === "stars"
      ? null
      : (screen?.rubrics.find((r) => r.id === (view === "auto" ? autoRubricId : view)) ?? null);
  const shots = useMemo(
    () => (view === "stars" ? starred : sortShots(activeRubric?.photos ?? [])),
    [view, starred, activeRubric],
  );

  // Measure the free area under the header — the grid must fit it without scrolling.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [screen?.photoCount]);

  const maxPerPage = box.w && box.h ? capacity(box.w, box.h) : 1;
  const pages = Math.max(1, Math.ceil(shots.length / maxPerPage));
  // Split evenly (50 photos → 25 + 25, not 44 + 6), so every page looks the same.
  const perPage = Math.max(1, Math.ceil(shots.length / pages));
  const safePage = Math.min(page, pages - 1);
  const pageShots = shots.slice(safePage * perPage, safePage * perPage + perPage);
  const grid = fitGrid(pageShots.length, box.w, box.h);

  // Back to page 1 when the rubric changes or a new photo arrives (newest is always on page 1).
  useEffect(() => setPage(0), [view, autoRubricId, newest?.id]);

  // Too many photos for one screen — flip pages by themselves.
  useEffect(() => {
    if (pages <= 1) return;
    const id = window.setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => window.clearInterval(id);
  }, [pages, view, autoRubricId]);

  // Re-render once a second so the "fresh" glow switches off on time.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Hide the mouse pointer on the broadcast when nobody moves it.
  useEffect(() => {
    let t = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), IDLE_CURSOR_MS);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // Delete needs a second click within 3 s.
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(null), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  // Keyboard: 0 — авто, 1–5 — рубрики, S — избранное, ← → — страницы, F — весь экран, Q — QR.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!screen || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === "0" || k === "a") setView("auto");
      else if (/^[1-9]$/.test(k)) {
        const r = screen.rubrics[Number(k) - 1];
        if (r) setView(r.id);
      } else if (k === "s") setView("stars");
      else if (k === "f") toggleFullscreen();
      else if (k === "q") setQrOpen((o) => !o);
      else if (e.key === "ArrowRight") setPage((p) => (p + 1) % pages);
      else if (e.key === "ArrowLeft") setPage((p) => (p - 1 + pages) % pages);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, pages, toggleFullscreen]);

  async function curate(shot: ScreenShot, action: "star" | "unstar" | "delete") {
    if (!screen) return;
    // Show the change at once; the server answer (or next poll) confirms it.
    setState({
      ...screen,
      photoCount: screen.photoCount - (action === "delete" ? 1 : 0),
      rubrics: screen.rubrics.map((r) => ({
        ...r,
        photos:
          action === "delete"
            ? r.photos.filter((p) => p.id !== shot.id)
            : r.photos.map((p) => (p.id === shot.id ? { ...p, starred: action === "star" } : p)),
      })),
    });
    setArmed(null);
    try {
      const res = await api<{ state: ScreenState }>("/api/host", {
        token,
        body: { action: "curate", eventId, submissionId: shot.id, curate: action },
      });
      if (res.state?.role === "screen") setState(res.state);
    } catch {
      // Next poll restores the true state.
    }
  }

  function applyPaste() {
    const t = paste.trim();
    if (!t) return;
    persistToken("screen", eventId, t);
    setToken(t);
  }

  if (!ready) {
    return (
      <main className="hall flex items-center justify-center">
        <p className="text-lg text-[var(--mute)]">Открываем экран…</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="hall flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="display text-5xl">Нужен токен экрана</h1>
          <p className="mt-4 text-[var(--mute)]">
            На панели ведущего нажмите «Экран зала» — откроется эта страница с доступом. Либо вставьте
            screen-токен ниже.
          </p>
          <div className="panel mt-8 space-y-3 text-left">
            <label className="label" htmlFor="screenToken">
              Screen-токен
            </label>
            <input
              id="screenToken"
              className="field"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="btn-lime w-full" disabled={!paste.trim()} onClick={applyPaste}>
              Открыть экран
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (loading && !screen) {
    return (
      <main className="hall flex items-center justify-center">
        <p className="text-xl text-[var(--mute)]">Синхронизация зала…</p>
      </main>
    );
  }

  if (!screen) {
    return (
      <main className="hall flex items-center justify-center">
        <p style={{ color: "var(--coral)" }}>{error || "Нет доступа к экрану"}</p>
      </main>
    );
  }

  const heading =
    view === "stars"
      ? { kicker: "Избранное", text: "Лучшие кадры вечера" }
      : activeRubric
        ? { kicker: `Рубрика ${activeRubric.index}`, text: activeRubric.text }
        : { kicker: "", text: "" };

  return (
    <main className={`hall flex flex-col ${idle ? "cursor-none" : ""}`}>
      <QrPopup open={qrOpen} onClose={() => setQrOpen(false)} joinUrl={joinUrl} title="Сканируй и войди" />

      {/* Top bar: event, rubric tabs, QR */}
      <header className="flex shrink-0 items-center gap-5">
        {screen.companyLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={screen.companyLogo} alt="" className="h-12 w-auto shrink-0 object-contain" />
        ) : null}
        <div className="min-w-0 shrink">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--mute)]">Фото-охота</p>
          <h1 className="display truncate text-3xl xl:text-4xl">{screen.title}</h1>
        </div>

        <nav className="mx-auto flex shrink-0 flex-wrap items-center justify-center gap-2">
          <Tab active={view === "auto"} onClick={() => setView("auto")} title="Показывать рубрику с последним фото">
            <span className="relative mr-1 inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lime)] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--lime)]" />
            </span>
            Авто
          </Tab>
          {screen.rubrics.map((r) => {
            const lit = view === "auto" ? r.id === autoRubricId : view === r.id;
            return (
              <Tab key={r.id} active={lit} soft={view === "auto"} onClick={() => setView(r.id)} title={r.text}>
                <span className="display text-lg">{r.index}</span>
                <span className="tabular-nums opacity-70">{r.photos.length}</span>
              </Tab>
            );
          })}
          {starred.length > 0 ? (
            <Tab active={view === "stars"} onClick={() => setView("stars")} title="Избранные фото">
              <Star filled /> <span className="tabular-nums">{starred.length}</span>
            </Tab>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden text-right text-sm leading-tight text-[var(--mute)] lg:block">
            <p>
              <span className="display text-2xl text-[var(--mist)]">{screen.photoCount}</span> кадров
            </p>
            <p>{screen.guestCount} гостей</p>
          </div>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            disabled={!joinUrl}
            className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/[0.03] p-2 pr-4 transition hover:border-[var(--lime)]"
            title="Открыть большой QR (Q)"
          >
            <span className="rounded-lg bg-white p-1.5">
              {joinUrl ? <QRCodeSVG value={joinUrl} size={64} level="M" /> : <span className="block h-16 w-16" />}
            </span>
            <span className="text-left text-sm leading-tight">
              <span className="block font-semibold">Присоединяйся</span>
              <span className="text-[var(--mute)]">наведи камеру</span>
            </span>
          </button>
        </div>
      </header>

      {screen.photoCount === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="h-20 w-20 animate-shutter rounded-full border-2 border-[var(--lime)]" />
          <p className="display mt-8 text-5xl md:text-7xl">Ждём первые кадры</p>
          <p className="mt-4 max-w-lg text-lg text-[var(--mute)]">
            Сканируйте QR, выберите рубрику и снимите фото — оно сразу появится здесь.
          </p>
        </div>
      ) : (
        <>
          {/* Rubric title */}
          <div key={view === "auto" ? autoRubricId : view} className="mt-5 flex shrink-0 animate-rise items-end gap-4">
            <p className="display shrink-0 text-2xl" style={{ color: "var(--lime)" }}>
              {heading.kicker}
            </p>
            <h2 className="display min-w-0 truncate text-3xl text-[var(--mist)] xl:text-5xl">{heading.text}</h2>
            <div className="ml-auto flex shrink-0 items-center gap-3 text-sm text-[var(--mute)]">
              {pages > 1 ? (
                <span className="flex items-center gap-1.5">
                  {Array.from({ length: pages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i)}
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: i === safePage ? 28 : 8,
                        background: i === safePage ? "var(--lime)" : "rgba(255,255,255,0.25)",
                      }}
                      aria-label={`Страница ${i + 1}`}
                    />
                  ))}
                </span>
              ) : null}
              <span className="tabular-nums">{shots.length} фото</span>
            </div>
          </div>

          {/* Photo grid — always fits the screen, tiles grow or shrink with the count */}
          <div ref={gridRef} className="relative mt-4 min-h-0 flex-1">
            {shots.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="display text-4xl text-[var(--mute)]">
                  {view === "stars" ? "Отметьте лучшие фото звёздочкой" : "В этой рубрике пока пусто"}
                </p>
                <p className="mt-3 text-[var(--mute)]">
                  {view === "stars" ? "Наведите на фото и нажмите ★" : "Первый кадр — ваш!"}
                </p>
              </div>
            ) : grid.size > 0 ? (
              <div
                className="absolute inset-0 grid content-center justify-center"
                style={{
                  gap: GAP,
                  gridTemplateColumns: `repeat(${grid.cols}, ${grid.size}px)`,
                  gridAutoRows: `${grid.size}px`,
                }}
              >
                {pageShots.map((shot) => (
                  <Tile
                    key={shot.id}
                    shot={shot}
                    size={grid.size}
                    fresh={isFresh(shot.id)}
                    showRubric={view === "stars"}
                    rubricIndex={screen.rubrics.find((r) => r.id === shot.missionId)?.index}
                    armed={armed === shot.id}
                    controls={!idle}
                    onStar={() => void curate(shot, shot.starred ? "unstar" : "star")}
                    onDelete={() => (armed === shot.id ? void curate(shot, "delete") : setArmed(shot.id))}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* Small hint for the operator; hidden from the broadcast once the mouse rests */}
      <div
        className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-[var(--mute)] transition-opacity ${
          idle ? "opacity-0" : "opacity-100"
        }`}
      >
        0 авто · 1–5 рубрики · S избранное · ← → страницы · F весь экран · Q QR
      </div>
      <button
        type="button"
        onClick={toggleFullscreen}
        className={`absolute bottom-2 right-3 rounded-lg px-2 py-1 text-xs text-[var(--mute)] transition-opacity hover:text-[var(--mist)] ${
          idle ? "opacity-0" : "opacity-100"
        }`}
      >
        ⛶ весь экран
      </button>
    </main>
  );
}

function Tab({
  active,
  soft,
  onClick,
  title,
  children,
}: {
  active: boolean;
  soft?: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition"
      style={
        active
          ? soft
            ? { borderColor: "var(--lime)", color: "var(--lime)", background: "rgba(200,245,66,0.08)" }
            : { borderColor: "var(--lime)", color: "#000", background: "var(--lime)" }
          : { borderColor: "var(--line)", color: "var(--mist)", background: "rgba(255,255,255,0.03)" }
      }
    >
      {children}
    </button>
  );
}

function Star({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tile({
  shot,
  size,
  fresh,
  showRubric,
  rubricIndex,
  armed,
  controls,
  onStar,
  onDelete,
}: {
  shot: ScreenShot;
  size: number;
  fresh: boolean;
  showRubric: boolean;
  rubricIndex?: number;
  armed: boolean;
  controls: boolean;
  onStar: () => void;
  onDelete: () => void;
}) {
  const big = size >= 320;
  return (
    <figure
      className={`group relative animate-rise overflow-hidden rounded-2xl bg-black/30 transition-shadow duration-700 ${
        fresh ? "tile-fresh" : ""
      }`}
      style={{
        boxShadow: shot.starred
          ? "0 0 0 3px var(--lime), 0 16px 50px rgba(200,245,66,0.25)"
          : "0 0 0 1px var(--line)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.photo} alt="" className="h-full w-full object-cover" loading="eager" />

      <figcaption
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent ${
          big ? "px-4 pb-3 pt-10" : "px-2.5 pb-2 pt-6"
        }`}
      >
        <p className={`truncate font-semibold ${big ? "text-xl" : size >= 200 ? "text-sm" : "text-xs"}`}>
          {showRubric && rubricIndex ? <span style={{ color: "var(--lime)" }}>{rubricIndex} · </span> : null}
          {shot.guestName}
        </p>
      </figcaption>

      {shot.starred ? (
        <span
          className="absolute left-2 top-2 flex items-center justify-center rounded-full p-1.5 text-black"
          style={{ background: "var(--lime)" }}
        >
          <Star filled />
        </span>
      ) : null}
      {fresh && !shot.starred ? (
        <span
          className="absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-black"
          style={{ background: "var(--lime)" }}
        >
          new
        </span>
      ) : null}

      {/* Host controls — appear only under the mouse */}
      <div
        className={`absolute right-2 top-2 flex gap-1.5 transition-opacity ${
          armed ? "opacity-100" : controls ? "opacity-0 group-hover:opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onStar}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 backdrop-blur transition hover:scale-110"
          style={{ color: shot.starred ? "var(--lime)" : "#fff" }}
          title={shot.starred ? "Убрать из избранного" : "В избранное"}
        >
          <Star filled={shot.starred} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={`flex h-9 items-center justify-center rounded-full backdrop-blur transition hover:scale-105 ${
            armed ? "px-3 text-sm font-semibold" : "w-9"
          }`}
          style={{ background: armed ? "var(--coral)" : "rgba(0,0,0,0.7)", color: "#fff" }}
          title="Удалить с экрана"
        >
          {armed ? "Удалить?" : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </figure>
  );
}
