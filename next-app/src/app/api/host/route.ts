import { bearerToken, readBodyLimited } from "@/lib/auth";
import { err, json } from "@/lib/json";
import { BODY_HOST_MAX } from "@/lib/limits";
import { rateLimit, requestLimitKey } from "@/lib/rateLimit";
import { moderateSubmission, updateHostEvent } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return err("Нужен токен ведущего", 401);
    // Per-device bucket (by token): one shared bucket for the whole hall
    // blocked everyone after 4–5 phones.
    if (!rateLimit(requestLimitKey(req, "host", token), 120, 60_000)) {
      return err("Слишком часто", 429);
    }
    const body = (await readBodyLimited(req, BODY_HOST_MAX)) as {
      action?: string;
      eventId?: string;
      submissionId?: string;
      status?: "approved" | "rejected";
      title?: string;
      missions?: unknown;
      eventStatus?: "draft" | "live" | "closed";
      companyLogo?: string | null;
    };
    const eventId = String(body.eventId ?? "");
    if (body.action === "moderate") {
      const state = await moderateSubmission(
        eventId,
        token,
        String(body.submissionId ?? ""),
        body.status === "rejected" ? "rejected" : "approved",
      );
      return json({ state });
    }
    if (body.action === "update") {
      const state = await updateHostEvent(eventId, token, {
        title: body.title,
        missions: body.missions,
        status: body.eventStatus,
        companyLogo: body.companyLogo,
      });
      return json({ state });
    }
    return err("Неизвестное действие");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Ошибка ведущего", 400);
  }
}
