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
 * Gate hunt creation for a Public app: shared operator secret from env.
 * Local PGlite runs allow create without a secret so smoke tests work.
 */
export function assertCanCreateEvent(provided: string | undefined): void {
  const expected = process.env.EVENT_CREATE_SECRET?.trim() ?? "";
  const got = String(provided ?? "").trim();

  if (expected) {
    if (!got || !safeEqualString(got, expected)) {
      throw new Error("Нужен секрет создания события");
    }
    return;
  }

  if (isLocalDevRuntime()) return;

  throw new Error("Создание отключено: задайте EVENT_CREATE_SECRET в Secrets");
}
