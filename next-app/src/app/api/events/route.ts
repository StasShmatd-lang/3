import { err, json } from "@/lib/json";
import { BODY_CREATE_MAX } from "@/lib/limits";
import { readBodyLimited } from "@/lib/auth";
import { assertCanCreateEvent } from "@/lib/createGate";
import { durableRateLimit, requestLimitKey } from "@/lib/rateLimit";
import { createEvent, toHostState } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!(await durableRateLimit(requestLimitKey(req, "create"), 3, 60_000))) {
      return err("Слишком часто. Подождите минуту", 429);
    }
    const body = (await readBodyLimited(req, BODY_CREATE_MAX)) as {
      title?: string;
      missions?: unknown;
      companyLogo?: string;
      createSecret?: string;
    };
    assertCanCreateEvent(body.createSecret);
    const { event, hostToken } = await createEvent({
      title: String(body.title ?? ""),
      missions: body.missions,
      companyLogo: body.companyLogo,
    });
    return json({
      eventId: event.id,
      hostToken,
      screenToken: event.screenToken,
      guestAccessKey: event.guestAccessKey,
      state: toHostState(event),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка создания";
    const status =
      message.includes("секрет") || message.includes("Создание отключено") ? 401 : 400;
    return err(message, status);
  }
}
