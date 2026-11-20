import { bearerToken } from "@/lib/auth";
import { err, json } from "@/lib/json";
import { rateLimit, requestLimitKey } from "@/lib/rateLimit";
import { loadEvent, resolveState } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return err("Нужен Bearer-токен", 401);
    if (!rateLimit(requestLimitKey(req, "state", token), 90, 60_000)) {
      return err("Слишком часто", 429);
    }
    const eventId = new URL(req.url).searchParams.get("eventId")?.trim();
    if (!eventId) return err("Нужен eventId", 400);
    const event = await loadEvent(eventId);
    if (!event) return err("Событие не найдено", 404);
    const state = resolveState(event, token);
    if (!state) return err("Нет доступа", 403);
    return json(state);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Ошибка", 400);
  }
}
