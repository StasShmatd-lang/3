import { readBodyLimited } from "@/lib/auth";
import { err, json } from "@/lib/json";
import { rateLimit, requestLimitKey } from "@/lib/rateLimit";
import { joinGuest } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!rateLimit(requestLimitKey(req, "join"), 12, 60_000)) {
      return err("Слишком часто", 429);
    }
    const body = (await readBodyLimited(req, 8_000)) as {
      eventId?: string;
      accessKey?: string;
      name?: string;
    };
    const result = await joinGuest(
      String(body.eventId ?? ""),
      String(body.accessKey ?? ""),
      String(body.name ?? ""),
    );
    return json(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Ошибка входа", 400);
  }
}
