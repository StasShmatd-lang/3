"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  joinUrl: string;
  accessKey: string;
  title?: string;
};

export function QrPopup({ open, onClose, joinUrl, accessKey, title }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="QR для гостей"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-sm animate-rise rounded-3xl border border-[var(--line)] p-6 text-center shadow-2xl"
        style={{ background: "var(--panel)" }}
      >
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--mute)]">
          {title || "Сканируй и войди"}
        </p>
        <div className="mt-5 inline-block rounded-2xl bg-white p-4">
          <QRCodeSVG value={joinUrl} size={220} level="M" />
        </div>
        <p
          className="display mt-5 text-5xl tracking-[0.35em]"
          style={{ color: "var(--lime)" }}
        >
          {accessKey}
        </p>
        <p className="mt-2 text-sm text-[var(--mute)]">ключ события · 4 символа</p>
        <button type="button" className="btn-ghost mt-6 w-full" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
