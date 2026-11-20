"use client";

import { useParams } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";
import { BrandFooter } from "@/components/BrandFooter";
import { QrPopup } from "@/components/QrPopup";
import { usePollState } from "@/hooks/usePollState";
import { loadToken, persistToken, readHashParam } from "@/lib/sessionKeys";
import type { ScreenState } from "@/lib/types";

function resolveScreenToken(eventId: string) {
  const fromHash = readHashParam("s");
  if (fromHash) {
    persistToken("screen", eventId, fromHash);
    return fromHash;
  }
  return loadToken("screen", eventId);
}

export function ScreenInner() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [paste, setPaste] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const { state, error, loading } = usePollState(eventId, token || undefined);
  const screen = state?.role === "screen" ? (state as ScreenState) : null;

  useLayoutEffect(() => {
    const next = resolveScreenToken(eventId);
    if (readHashParam("s")) {
      window.history.replaceState(null, "", `/screen/${eventId}`);
    }
    setToken(next);
    setOrigin(window.location.origin);
    setReady(true);
  }, [eventId]);

  const joinUrl = useMemo(
    () => (origin ? `${origin}/join/${eventId}` : ""),
    [origin, eventId],
  );

  const rubricsWithPhotos = useMemo(
    () => screen?.rubrics.filter((r) => r.photos.length > 0) ?? [],
    [screen],
  );

  function applyPaste() {
    const t = paste.trim();
    if (!t) return;
    persistToken("screen", eventId, t);
    setToken(t);
  }

  if (!ready) {
    return (
      <main className="shell-hall flex items-center justify-center">
        <p className="text-lg text-[var(--mute)]">Открываем экран…</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="shell-hall flex items-center justify-center px-6">
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
      <main className="shell-hall flex items-center justify-center">
        <p className="text-xl text-[var(--mute)]">Синхронизация зала…</p>
      </main>
    );
  }

  if (!screen) {
    return (
      <main className="shell-hall flex items-center justify-center">
        <p style={{ color: "var(--coral)" }}>{error || "Нет доступа к экрану"}</p>
      </main>
    );
  }

  return (
    <main className="shell-hall">
      <QrPopup
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        joinUrl={joinUrl}
        title="Сканируй и войди"
      />

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          {screen.companyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={screen.companyLogo} alt="" className="mb-4 h-12 w-auto object-contain" />
          ) : null}
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--mute)]">Галерея зала</p>
          <h1 className="display mt-2 text-5xl md:text-7xl">{screen.title}</h1>
          <p className="mt-3 text-lg text-[var(--mute)]">
            Кадров: {screen.photoCount} · гостей: {screen.guestCount}
          </p>
        </div>
        <button type="button" className="btn-lime" disabled={!joinUrl} onClick={() => setQrOpen(true)}>
          Показать QR
        </button>
      </header>

      {screen.photoCount === 0 ? (
        <div className="mt-16 flex min-h-[40vh] flex-col items-center justify-center text-center">
          <div className="h-20 w-20 animate-shutter rounded-full border-2 border-[var(--lime)]" />
          <p className="display mt-8 text-4xl md:text-6xl">Ждём первые кадры</p>
          <p className="mt-3 max-w-md text-[var(--mute)]">
            Гость снял фото по рубрике — оно сразу появится здесь.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {rubricsWithPhotos.map((rubric) => (
            <section key={rubric.id} className="animate-cascade">
              <div className="mb-5 flex flex-wrap items-end gap-3 border-b border-[var(--line)] pb-3">
                <p
                  className="display text-2xl md:text-3xl"
                  style={{ color: "var(--lime)" }}
                >
                  {rubric.index}.
                </p>
                <h2 className="display text-3xl text-[var(--mist)] md:text-4xl">{rubric.text}</h2>
                <span className="ml-auto text-sm text-[var(--mute)]">{rubric.photos.length} фото</span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {rubric.photos.map((shot) => (
                  <figure
                    key={shot.id}
                    className="overflow-hidden rounded-2xl border border-[var(--line)] bg-black/25"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.photo} alt="" className="aspect-square w-full object-cover" />
                    <figcaption className="p-2.5">
                      <p className="truncate font-semibold">{shot.guestName}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <BrandFooter />
    </main>
  );
}
