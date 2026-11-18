"use client";

import { useMemo, useState } from "react";
import { BrandFooter } from "@/components/BrandFooter";
import { HeroVisual } from "@/components/HeroVisual";
import { api } from "@/lib/apiClient";
import { fileToDataUrl } from "@/lib/photo";
import { defaultMissionDrafts } from "@/lib/storeDefaults";

type Draft = { id: string; text: string; refPhoto: string };

export default function HomePage() {
  const [title, setTitle] = useState("Корп · Фото-охота");
  const [missions, setMissions] = useState<Draft[]>(() => defaultMissionDrafts());
  const [logo, setLogo] = useState<string>("");
  const [createSecret, setCreateSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"hero" | "setup">("hero");

  const ready = useMemo(
    () => title.trim().length >= 2 && missions.every((m) => m.text.trim().length >= 3),
    [title, missions],
  );

  async function onLogo(file: File | null) {
    if (!file) return;
    try {
      setLogo(await fileToDataUrl(file, { maxSide: 512, maxChars: 280_000 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка лого");
    }
  }

  async function onRef(i: number, file: File | null) {
    if (!file) return;
    try {
      const data = await fileToDataUrl(file, { maxSide: 640, maxChars: 280_000 });
      setMissions((prev) => prev.map((m, idx) => (idx === i ? { ...m, refPhoto: data } : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка фото");
    }
  }

  async function create() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        eventId: string;
        hostToken: string;
        screenToken?: string;
      }>("/api/events", {
        body: {
          title,
          companyLogo: logo || undefined,
          createSecret: createSecret || undefined,
          missions: missions.map((m) => ({
            id: m.id,
            text: m.text.trim(),
            refPhoto: m.refPhoto || undefined,
          })),
        },
      });
      if (!res.eventId || !res.hostToken) {
        throw new Error("Сервер не вернул ключ ведущего");
      }
      if (createSecret) sessionStorage.setItem("ph-create-secret", createSecret);
      try {
        localStorage.setItem(`ph-host:${res.eventId}`, res.hostToken);
        sessionStorage.setItem(`ph-host:${res.eventId}`, res.hostToken);
        if (res.screenToken) {
          localStorage.setItem(`ph-screen:${res.eventId}`, res.screenToken);
          sessionStorage.setItem(`ph-screen:${res.eventId}`, res.screenToken);
        }
      } catch {
        // storage may be blocked in some previews — hash handoff below still works
      }
      // Hash (not query) carries the host token once; avoids "Нет ключа ведущего"
      // when localStorage is empty/partitioned. Full assign also avoids Turbopack chunk misses.
      window.location.assign(
        `/host/${res.eventId}#h=${encodeURIComponent(res.hostToken)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать");
      setBusy(false);
    }
  }

  if (step === "hero") {
    return (
      <main className="shell">
        <div className="stagger flex min-h-[82vh] flex-col justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="Stanislav Shmidt"
            className="animate-rise mb-6 h-12 w-auto object-contain"
          />
          <h1 className="display animate-rise text-5xl text-[var(--mist)] sm:text-6xl">
            Фото-
            <span style={{ color: "var(--lime)" }}>охота</span>
          </h1>
          <p className="animate-rise mt-4 max-w-sm text-base leading-relaxed text-[var(--mute)]">
            Пять миссий по залу. Гости грузят кадры — вы решаете, что попадает на большой экран.
          </p>
          <div className="animate-rise mt-8">
            <button type="button" className="btn-lime w-full sm:w-auto" onClick={() => setStep("setup")}>
              Создать охоту
            </button>
          </div>
          <HeroVisual />
        </div>
        <BrandFooter />
      </main>
    );
  }

  return (
    <main className="shell-wide">
      <button type="button" className="btn-ghost mb-6 text-sm" onClick={() => setStep("hero")}>
        ← Назад
      </button>
      <h1 className="display text-4xl md:text-5xl">
        Настройка <span style={{ color: "var(--ice)" }}>охоты</span>
      </h1>
      <p className="mt-2 max-w-xl text-[var(--mute)]">Название и ровно 5 миссий. Референс-фото — по желанию.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel space-y-4">
          <div>
            <label className="label" htmlFor="title">
              Название ивента
            </label>
            <input
              id="title"
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>
          <div>
            <label className="label" htmlFor="logo">
              Лого компании (опционально)
            </label>
            <input
              id="logo"
              type="file"
              accept="image/*"
              className="field file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--lime)] file:px-3 file:py-1 file:text-black"
              onChange={(e) => void onLogo(e.target.files?.[0] ?? null)}
            />
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Лого" className="mt-3 h-16 w-auto rounded-lg object-contain" />
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="createSecret">
              Секрет создания (на проде — из Secrets)
            </label>
            <input
              id="createSecret"
              type="password"
              className="field"
              value={createSecret}
              autoComplete="off"
              onChange={(e) => setCreateSecret(e.target.value)}
              placeholder="локально можно пусто"
            />
          </div>
        </section>

        <section className="panel">
          <p className="text-sm text-[var(--mute)]">
            После старта гости вводят ключ события (не в URL). Токены экрана — только в hash.
          </p>
          <button
            type="button"
            className="btn-lime mt-5 w-full"
            disabled={!ready || busy}
            onClick={() => void create()}
          >
            {busy ? "Создаём…" : "Запустить охоту"}
          </button>
          {error ? <p className="mt-3 text-sm" style={{ color: "var(--coral)" }}>{error}</p> : null}
        </section>
      </div>

      <section className="mt-8 space-y-4">
        {missions.map((m, i) => (
          <div key={m.id} className="panel grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div
              className="display flex h-12 w-12 items-center justify-center rounded-2xl text-lg text-black"
              style={{ background: i % 2 === 0 ? "var(--lime)" : "var(--coral)" }}
            >
              {i + 1}
            </div>
            <div>
              <label className="label" htmlFor={`m-${i}`}>
                Миссия {i + 1}
              </label>
              <input
                id={`m-${i}`}
                className="field"
                value={m.text}
                maxLength={160}
                onChange={(e) =>
                  setMissions((prev) =>
                    prev.map((row, idx) => (idx === i ? { ...row, text: e.target.value } : row)),
                  )
                }
              />
            </div>
            <div>
              <label className="label" htmlFor={`r-${i}`}>
                Референс
              </label>
              <input
                id={`r-${i}`}
                type="file"
                accept="image/*"
                className="field max-w-[14rem] text-sm file:mr-2 file:rounded-md file:border-0 file:bg-[var(--ice)] file:px-2 file:py-1 file:text-black"
                onChange={(e) => void onRef(i, e.target.files?.[0] ?? null)}
              />
              {m.refPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.refPhoto} alt="" className="mt-2 h-14 w-14 rounded-lg object-cover" />
              ) : null}
            </div>
          </div>
        ))}
      </section>
      <BrandFooter />
    </main>
  );
}
