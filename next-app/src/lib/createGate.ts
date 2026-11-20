import { timingSafeEqual } from "node:crypto";

function safeEqualString(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

/** True only on this VM / local next without platform env. */
export function isLocalDevRuntime() {
  return !process.env.DATABASE_URL?.trim() && !process.env.CURSOR_APP_ID?.trim();
}

/**
 * Gate hunt creation via EVENT_CREATE_SECRET (platform Secrets).
 * Local PGlite runs allow create without a secret so smoke tests work.
 * Password is never shipped in source — only compared to the env value.
 */
export function assertCanCreateEvent(provided: string | undefined): void {
  const expected = process.env.EVENT_CREATE_SECRET?.trim() ?? "";
  const got = String(provided ?? "").trim();

  if (expected) {
    if (!got || !safeEqualString(got, expected)) {
      throw new Error("Неверный пароль");
    }
    return;
  }

  if (isLocalDevRuntime()) return;

  throw new Error("Создание отключено");
}
