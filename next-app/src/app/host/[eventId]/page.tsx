"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandFooter } from "@/components/BrandFooter";
import { QrPopup } from "@/components/QrPopup";
import { StatusPill } from "@/components/StatusPill";
import { usePollState } from "@/hooks/usePollState";
import { api } from "@/lib/apiClient";
import { loadToken, persistToken, readHashParam } from "@/lib/sessionKeys";
import type { HostState } from "@/lib/types";

export default function HostPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [token, setToken] = useState<string>("");
  const [paste, setPaste] = useState("");
  const [booting, setBooting] = useState(true);
  const [origin, setOrigin] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const { state, error, loading, setState } = usePollState(eventId, token || undefined);
  const host = state?.role === "host" ? (state as HostState) : null;

  useEffect(() => {
    const fromHash = readHashParam("h");
    const next = fromHash || loadToken("host", eventId);
    if (fromHash) {
      persistToken("host", eventId, fromHash);
      window.history.replaceState(null, "", `/host/${eventId}`);
    }
    setToken(next);
    setOrigin(window.location.origin);
    setBooting(false);
    // Warm the screen route so «Экран зала» opens faster.
    void fetch(`/screen/${eventId}`).catch(() => undefined);
  }, [eventId]);

  useEffect(() => {
    if (host?.screenToken) persistToken("screen", eventId, host.screenToken);
  }, [eventId, host?.screenToken]);

  const joinUrl = useMemo(() => (origin ? `${origin}/join/${eventId}` : ""), [origin, eventId]);

  function openHallScreen() {
    if (!host?.screenToken) return;
    persistToken("screen", eventId, host.screenToken);
    const path = `/screen/${eventId}#s=${encodeURIComponent(host.screenToken)}`;
    window.open(path, "_blank", "noopener,noreferrer");
  }

  async function setStatus(eventStatus: "live" | "closed") {
    if (!token) return;
    const res = await api<{ state: HostState }>("/api/host", {
      token,
      body: { action: "update", eventId, eventStatus },
    });
    setState(res.state);
  }

  function applyPaste() {
    const t = paste.trim();
    if (!t) return;
    persistToken("host", eventId, t);
    setToken(t);
  }

  if (booting) {
    return (
      <main className="shell">
        <p className="text-[var(--mute)]">Открываем панель ведущего…</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="shell">
        <h1 className="display text-4xl">Нет ключа ведущего</h1>
        <p className="mt-3 text-[var(--mute)]">
          Создайте охоту заново с главной — ключ передаётся в hash ссылки. Или вставьте host-токен, если он
          сохранился.
        </p>
        <div className="panel mt-6 space-y-3">
          <label className="label" htmlFor="hostToken">
            Host-токен
          </label>
          <input
            id="hostToken"
            className="field"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            autoComplete="off"
            placeholder="вставьте токен"
          />
          <button type="button" className="btn-lime w-full" onClick={applyPaste} disabled={!paste.trim()}>
            Войти как ведущий
          </button>
          <Link href="/" className="btn-ghost inline-flex w-full">
            На главную
          </Link>
        </div>
        <BrandFooter />
      </main>
    );
  }

  if (loading && !host) {
    return (
      <main className="shell">
        <p className="text-[var(--mute)]">Загружаем панель…</p>
      </main>
    );
  }

  if (!host) {
    return (
      <main className="shell">
        <h1 className="display text-3xl">Ошибка</h1>
        <p className="mt-2" style={{ color: "var(--coral)" }}>
          {error || "Нет доступа"}
        </p>
        <Link href="/" className="btn-ghost mt-6 inline-flex">
          На главную
        </Link>
        <BrandFooter />
      </main>
    );
  }

  const live = [...host.submissions]
    .filter((s) => s.status === "approved")
    .sort((a, b) => b.createdAt - a.createdAt);
  const quotaPct = Math.min(100, Math.round((host.uploadBytesUsed / host.uploadQuotaBytes) * 100));

  return (
    <main className="shell-wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--mute)]">Ведущий</p>
          <h1 className="display mt-1 text-4xl md:text-5xl">{host.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => void setStatus("live")}>
            Открыто
          </button>
          <button type="button" className="btn-coral" onClick={() => void setStatus("closed")}>
            Закрыть загрузки
          </button>
        </div>
      </div>

      <QrPopup
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        joinUrl={joinUrl}
        accessKey={host.guestAccessKey}
        title="QR для гостей"
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <section className="panel lg:col-span-1">
          <p className="label">Ключ для гостей</p>
          <p className="display text-5xl tracking-[0.35em]" style={{ color: "var(--lime)" }}>
            {host.guestAccessKey}
          </p>
          <p className="mt-2 text-sm text-[var(--mute)]">4 символа · ввод у гостя, не в URL</p>
          <button
            type="button"
            className="btn-lime mt-5 w-full"
            disabled={!joinUrl}
            onClick={() => setQrOpen(true)}
          >
            Показать QR
          </button>
          <button
            type="button"
            className="btn-ghost mt-3 w-full"
            disabled={!host.screenToken}
            onClick={openHallScreen}
          >
            Экран зала
          </button>
          <div className="mt-5">
            <p className="label">Квота загрузок</p>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full" style={{ width: `${quotaPct}%`, background: "var(--ice)" }} />
            </div>
            <p className="mt-1 text-xs text-[var(--mute)]">
              {quotaPct}% · гостей {host.guestCount} · статус {host.status}
            </p>
          </div>
        </section>

        <section className="panel lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="display text-2xl">Живая лента</h2>
            <span className="text-sm text-[var(--mute)]">на экране: {live.length}</span>
          </div>
          <p className="mb-4 text-sm text-[var(--mute)]">
            Без модерации: гость сфотографировал — кадр сразу в зале, по рубрике миссии.
          </p>
          {live.length === 0 ? (
            <p className="text-[var(--mute)]">Пока тихо — ждём кадры с телефонов.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {live.slice(0, 8).map((s) => (
                <article key={s.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.photo} alt="" className="aspect-[4/3] w-full object-cover" />
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{s.guestName}</p>
                      <StatusPill status={s.status} />
                    </div>
                    <p className="text-sm text-[var(--mute)]">{s.missionText}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 panel">
        <h2 className="display text-2xl">Рубрики</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {host.missions.map((m, i) => {
            const count = host.submissions.filter(
              (s) => s.missionId === m.id && s.status === "approved",
            ).length;
            return (
              <li key={m.id} className="rounded-2xl border border-[var(--line)] bg-black/15 p-4">
                <p className="text-xs uppercase tracking-widest" style={{ color: "var(--lime)" }}>
                  рубрика {i + 1} · {count} фото
                </p>
                <p className="mt-1 font-semibold">{m.text}</p>
              </li>
            );
          })}
        </ol>
      </section>
      <BrandFooter />
    </main>
  );
}
