"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandFooter } from "@/components/BrandFooter";
import { StatusPill } from "@/components/StatusPill";
import { usePollState } from "@/hooks/usePollState";
import { api } from "@/lib/apiClient";
import { fileToDataUrl } from "@/lib/photo";
import type { GuestState } from "@/lib/types";

function readHashKey() {
  if (typeof window === "undefined") return "";
  const raw = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);
  return (params.get("k") || "").trim().toUpperCase();
}

export function JoinInner() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [metaTitle, setMetaTitle] = useState("Фото-охота");
  const [accessKey, setAccessKey] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<string | null>(null);
  const { state, setState, refresh } = usePollState(eventId, token || undefined);
  const guest = state?.role === "guest" ? (state as GuestState) : null;

  useEffect(() => {
    const saved = localStorage.getItem(`ph-guest:${eventId}`) || "";
    if (saved) setToken(saved);
    const hk = readHashKey();
    if (hk) setAccessKey(hk);
  }, [eventId]);

  useEffect(() => {
    if (guest?.title) setMetaTitle(guest.title);
  }, [guest?.title]);

  const byMission = useMemo(() => {
    const map = new Map<string, GuestState["mySubmissions"][number]>();
    guest?.mySubmissions.forEach((s) => map.set(s.missionId, s));
    return map;
  }, [guest]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ guestToken: string; state: GuestState }>("/api/guest/join", {
        body: { eventId, accessKey, name },
      });
      localStorage.setItem(`ph-guest:${eventId}`, res.guestToken);
      setToken(res.guestToken);
      setState(res.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  async function upload(missionId: string, file: File | null) {
    if (!file || !token) return;
    setBusy(true);
    setError(null);
    setActiveMission(missionId);
    try {
      const photo = await fileToDataUrl(file, { maxSide: 960, maxChars: 350_000 });
      const res = await api<{ state: GuestState }>("/api/guest/submit", {
        token,
        body: { eventId, missionId, photo },
      });
      setState(res.state);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
      setActiveMission(null);
    }
  }

  if (!token || !guest) {
    return (
      <main className="shell">
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--mute)]">Гость</p>
        <h1 className="display mt-2 text-5xl">
          {metaTitle}
        </h1>
        <p className="mt-3 text-[var(--mute)]">Введите ключ с экрана ведущего и своё имя — дальше 5 миссий.</p>
        <div className="panel mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="key">
              Ключ события
            </label>
            <input
              id="key"
              className="field uppercase tracking-[0.18em]"
              value={accessKey}
              maxLength={16}
              onChange={(e) => setAccessKey(e.target.value.toUpperCase())}
              placeholder="XXXXXXXXXXXX"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="name">
              Ваше имя
            </label>
            <input
              id="name"
              className="field"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="Аня"
            />
          </div>
          <button
            type="button"
            className="btn-lime w-full"
            disabled={busy || accessKey.length < 10 || name.trim().length < 2}
            onClick={() => void join()}
          >
            {busy ? "Входим…" : "Начать охоту"}
          </button>
          {error ? <p className="text-sm" style={{ color: "var(--coral)" }}>{error}</p> : null}
        </div>
        <BrandFooter />
      </main>
    );
  }

  return (
    <main className="shell">
      <p className="text-sm text-[var(--mute)]">Привет, {guest.name}</p>
      <h1 className="display mt-1 text-4xl">{guest.title}</h1>
      <p className="mt-2 text-sm text-[var(--mute)]">
        Статус: {guest.status === "live" ? "можно грузить" : "загрузки закрыты"}
      </p>
      {error ? <p className="mt-3 text-sm" style={{ color: "var(--coral)" }}>{error}</p> : null}

      <div className="mt-6 space-y-4">
        {guest.missions.map((m, i) => {
          const sub = byMission.get(m.id);
          return (
            <article key={m.id} className="panel animate-rise" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest" style={{ color: "var(--lime)" }}>
                    миссия {i + 1}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-snug">{m.text}</h2>
                </div>
                {sub ? <StatusPill status={sub.status} /> : null}
              </div>
              {m.refPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.refPhoto} alt="Референс" className="mt-3 h-28 w-full rounded-xl object-cover" />
              ) : null}
              {sub ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sub.photo} alt="Ваше фото" className="mt-3 aspect-[4/3] w-full rounded-xl object-cover" />
              ) : guest.status === "live" ? (
                <label className="btn-ghost mt-4 w-full cursor-pointer">
                  {busy && activeMission === m.id ? "Сжимаем…" : "Снять / выбрать фото"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => void upload(m.id, e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : (
                <p className="mt-3 text-sm text-[var(--mute)]">Ведущий закрыл приём фото</p>
              )}
            </article>
          );
        })}
      </div>
      <BrandFooter />
    </main>
  );
}
