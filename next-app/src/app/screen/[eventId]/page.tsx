import { Suspense } from "react";
import { ScreenInner } from "./ScreenInner";

export default function ScreenPage() {
  return (
    <Suspense fallback={<main className="shell-hall"><p className="text-[var(--mute)]">Экран…</p></main>}>
      <ScreenInner />
    </Suspense>
  );
}
