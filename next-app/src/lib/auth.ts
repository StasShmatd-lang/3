import { createHash, randomBytes } from "node:crypto";

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

export function newAccessKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = randomBytes(6);
  for (let i = 0; i < 6; i++) out += alphabet[buf[i]! % alphabet.length];
  return out;
}

export async function readBodyLimited(req: Request, maxBytes: number): Promise<unknown> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new Error("Слишком большой запрос");
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Слишком большой запрос");
  if (!text) return {};
  return JSON.parse(text) as unknown;
}
