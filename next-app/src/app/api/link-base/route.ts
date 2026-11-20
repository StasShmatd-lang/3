import { json } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host");
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin;
  return json({ base: origin });
}
