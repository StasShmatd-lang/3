import { err, json } from "@/lib/json";
import { loadEvent, publicEventMeta } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const event = await loadEvent(id);
    if (!event) return err("Событие не найдено", 404);
    return json(publicEventMeta(event));
  } catch (e) {
    return err(e instanceof Error ? e.message : "Ошибка", 400);
  }
}
