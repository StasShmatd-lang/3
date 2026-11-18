import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function bearerToken(req: Request): string | undefined {
  const h = req.headers.get("authorization");
  if (!h) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || undefined;
}

export function tokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 20);
}

export function newToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

/** 4-char hall key (easy to shout). Brute-force mitigated by durable join rate limits. */
export function newAccessKey(length = 4) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[buf[i]! % alphabet.length];
  return out;
}

export function hashAccessKey(key: string) {
  return createHash("sha256").update(key.trim().toUpperCase()).digest("hex");
}

export function accessKeysMatch(provided: string, expectedPlain: string, expectedHash?: string) {
  const got = provided.trim().toUpperCase();
  if (expectedHash) {
    const a = Buffer.from(hashAccessKey(got));
    const b = Buffer.from(expectedHash);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
  const want = expectedPlain.trim().toUpperCase();
  const aa = Buffer.from(got);
  const bb = Buffer.from(want);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export async function readBodyLimited(req: Request, maxBytes: number): Promise<unknown> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new Error("Слишком большой запрос");
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Слишком большой запрос");
  if (!text) return {};
  return JSON.parse(text) as unknown;
}
