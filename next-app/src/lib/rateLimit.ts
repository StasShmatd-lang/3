import { tokenFingerprint } from "./auth";
import { sql } from "./db";

type Bucket = { n: number; reset: number };
const g = globalThis as unknown as { __phRate?: Map<string, Bucket> };
g.__phRate ??= new Map();

/** In-memory fallback (single instance). Prefer durableRateLimit for join/create. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  let b = g.__phRate!.get(key);
  if (!b || now > b.reset) b = { n: 0, reset: now + windowMs };
  b.n += 1;
  g.__phRate!.set(key, b);
  return b.n <= max;
}

/** Postgres/PGlite-backed limiter so counts hold across instances. */
export async function durableRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const rows = await sql<{ hits: number; reset_at: string | Date }>(
    "select hits, reset_at from rate_limits where bucket_key = $1",
    [key],
  );
  const row = rows[0];
  const resetMs = row ? new Date(row.reset_at).getTime() : 0;
  let hits = row?.hits ?? 0;
  let resetAt = resetMs;

  if (!row || now > resetMs) {
    hits = 1;
    resetAt = now + windowMs;
    await sql(
      `insert into rate_limits (bucket_key, hits, reset_at)
       values ($1, $2, to_timestamp($3 / 1000.0))
       on conflict (bucket_key) do update
       set hits = excluded.hits, reset_at = excluded.reset_at`,
      [key, hits, resetAt],
    );
    return hits <= max;
  }

  hits += 1;
  await sql("update rate_limits set hits = $2 where bucket_key = $1", [key, hits]);
  return hits <= max;
}

export function clientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  return real || xf || "unknown";
}

export function requestLimitKey(req: Request, scope: string, secret?: string) {
  const ip = clientIp(req);
  if (secret) return `${scope}:tok:${tokenFingerprint(secret)}`;
  return `${scope}:ip:${ip}`;
}
