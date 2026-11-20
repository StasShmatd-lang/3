import { bearerToken, readBodyLimited } from "@/lib/auth";
import { err, json } from "@/lib/json";
import { durableRateLimit, requestLimitKey } from "@/lib/rateLimit";
import { assertGuestAccess, gatedEventMeta, loadEvent } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Event metadata is no longer public by id.
 * Callers must prove the guest access key (Bearer or JSON body).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!(await durableRateLimit(requestLimitKey(req, "meta"), 30, 60_000))) {
      return err("Слишком часто", 429);
    }
    const { id } = await ctx.params;
    const body = (await readBodyLimited(req, 4_000)) as { accessKey?: string };
    const accessKey = bearerToken(req) || String(body.accessKey ?? "");
    if (!accessKey) return err("Нужен ключ события", 401);

    const event = await loadEvent(id);
    if (!event) return err("Событие не найдено", 404);
    assertGuestAccess(event, accessKey);
    return json(gatedEventMeta(event));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка";
    const status = message.includes("ключ") ? 401 : 400;
    return err(message, status);
  }
}

export async function GET() {
  return err("Метаданные события только с ключом (POST)", 405);
}
