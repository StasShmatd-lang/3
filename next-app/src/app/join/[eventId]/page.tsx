import { Suspense } from "react";
import { JoinInner } from "./JoinInner";

export default function JoinPage() {
  return (
    <Suspense fallback={<main className="shell"><p className="text-[var(--mute)]">Загрузка…</p></main>}>
      <JoinInner />
    </Suspense>
  );
}
