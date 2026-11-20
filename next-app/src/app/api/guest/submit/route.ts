import { bearerToken, readBodyLimited } from "@/lib/auth";
import { err, json } from "@/lib/json";
import { BODY_SUBMIT_MAX } from "@/lib/limits";
import { rateLimit, requestLimitKey } from "@/lib/rateLimit";
import { submitPhoto } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return err("Нужен токен гостя", 401);
    // Per-device bucket (by token): one shared bucket for the whole hall
    // blocked everyone after 4–5 phones.
    if (!rateLimit(requestLimitKey(req, "submit", token), 20, 60_000)) {
      return err("Слишком часто", 429);
    }
    const body = (await readBodyLimited(req, BODY_SUBMIT_MAX)) as {
      eventId?: string;
      missionId?: string;
      photo?: string;
    };
    const state = await submitPhoto(
      String(body.eventId ?? ""),
      token,
      String(body.missionId ?? ""),
      String(body.photo ?? ""),
    );
    return json({ state });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Ошибка загрузки", 400);
  }
}
