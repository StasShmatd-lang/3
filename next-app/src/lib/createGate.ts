import { createHash, timingSafeEqual } from "node:crypto";

/** SHA-256 of the party create password (plaintext is not stored in the repo). */
const CREATE_PASSWORD_SHA256 = Buffer.from(
  "972fd5aaf5efdfb1bf24a05357f588ab7ce8be397e3a4c0e9ef2265baa853ff1",
  "hex",
);

function passwordMatches(provided: string): boolean {
  const digest = createHash("sha256").update(provided, "utf8").digest();
  if (digest.length !== CREATE_PASSWORD_SHA256.length) return false;
  return timingSafeEqual(digest, CREATE_PASSWORD_SHA256);
}

/**
 * Gate hunt creation: one fixed party password (no Cursor Secrets / env).
 */
export function assertCanCreateEvent(provided: string | undefined): void {
  const got = String(provided ?? "").trim();
  if (!got || !passwordMatches(got)) {
    throw new Error("Неверный пароль");
  }
}
