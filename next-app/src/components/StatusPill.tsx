import type { SubmissionStatus } from "@/lib/types";

const map: Record<SubmissionStatus, { label: string; color: string }> = {
  pending: { label: "загрузка", color: "var(--ice)" },
  approved: { label: "на экране", color: "var(--lime)" },
  rejected: { label: "скрыто", color: "var(--coral)" },
};

export function StatusPill({ status }: { status: SubmissionStatus }) {
  const m = map[status];
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
      style={{ background: `${m.color}22`, color: m.color }}
    >
      {m.label}
    </span>
  );
}
