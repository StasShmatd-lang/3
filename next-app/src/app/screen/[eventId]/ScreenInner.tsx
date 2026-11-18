"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandFooter } from "@/components/BrandFooter";
import { QrPopup } from "@/components/QrPopup";
import { usePollState } from "@/hooks/usePollState";
import { api } from "@/lib/apiClient";
import type { ScreenState } from "@/lib/types";

function readScreenToken() {
  if (typeof window === "undefined") return "";
  const raw = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);
  return (params.get("s") || "").trim();
}

export function ScreenInner() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [token, setToken] = useState("");
  const [base, setBase] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const { state, error, loading } = usePollState(eventId, token || undefined);
  const screen = state?.role === "screen" ? (state as ScreenState) : null;

  useEffect(() => {
    setToken(readScreenToken());
    const onHash = () => setToken(readScreenToken());
    window.addEventListener("hashchange", onHash);
    void api<{ base: string }>("/api/link-base")
      .then((r) => setBase(r.base))
      .catch(() => setBase(window.location.origin));
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const joinUrl = useMemo(() => (base ? `${base}/join/${eventId}` : ""), [base, eventId]);

  if (!token) {
    return (
      <main className="shell-hall flex items-center justify-center">
        <div className="max-w-lg text-center">
          <h1 className="display text-5xl">Нужен токен экрана</h1>
          <p className="mt-4 text-[var(--mute)]">
            Откройте ссылку «Экран зала» из панели ведущего — токен в hash, не в query.
          </p>
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
        accessKey={screen.guestAccessKey}
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
            Одобрено: {screen.approved.length} · гостей: {screen.guestCount}
          </p>
        </div>
        <button
          type="button"
          className="btn-lime"
          disabled={!joinUrl}
          onClick={() => setQrOpen(true)}
        >
          Показать QR
        </button>
      </header>

      {screen.approved.length === 0 ? (
        <div className="mt-16 flex min-h-[40vh] flex-col items-center justify-center text-center">
          <div className="h-20 w-20 animate-shutter rounded-full border-2 border-[var(--lime)]" />
          <p className="display mt-8 text-4xl md:text-6xl">Ждём первые кадры</p>
          <p className="mt-3 max-w-md text-[var(--mute)]">Как только ведущий одобрит фото — оно вспыхнет здесь.</p>
        </div>
      ) : (
        <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {screen.approved.map((shot, i) => (
            <figure
              key={shot.id}
              className="mb-4 break-inside-avoid animate-cascade overflow-hidden rounded-2xl border border-[var(--line)] bg-black/25"
              style={{ animationDelay: `${(i % 8) * 0.05}s` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.photo} alt="" className="w-full object-cover" />
              <figcaption className="space-y-1 p-3">
                <p className="font-semibold">{shot.guestName}</p>
                <p className="text-sm text-[var(--mute)]">{shot.missionText}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <BrandFooter />
    </main>
  );
}
