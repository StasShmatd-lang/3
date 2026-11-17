import { readBodyLimited } from "@/lib/auth";
import { err, json } from "@/lib/json";
import { durableRateLimit, requestLimitKey } from "@/lib/rateLimit";
import { joinGuest } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!(await durableRateLimit(requestLimitKey(req, "join"), 8, 60_000))) {
      return err("Слишком часто", 429);
    }
    const body = (await readBodyLimited(req, 8_000)) as {
      eventId?: string;
      accessKey?: string;
      name?: string;
    };
    const eventId = String(body.eventId ?? "");
    if (eventId) {
      if (!(await durableRateLimit(`join:event:${eventId}`, 40, 60_000))) {
        return err("Слишком много попыток для этого события", 429);
      }
    }
    const result = await joinGuest(eventId, String(body.accessKey ?? ""), String(body.name ?? ""));
    return json(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Ошибка входа", 400);
  }
}
