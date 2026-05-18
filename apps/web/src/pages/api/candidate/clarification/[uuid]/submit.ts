import type { APIRoute } from "astro";

import { getClientIpFromRequest } from "../../../../../lib/client-ip";
import {
  ClarificationConflictError,
  ClarificationGoneError,
  ClarificationNotFoundError,
  submitClarificationAnswers,
} from "../../../../../lib/clarification/service";
import type { ClarificationAnswerInput } from "../../../../../lib/clarification/types";
import { ClarificationValidationError } from "../../../../../lib/clarification/validation";
import { getSubmissionServicePocketBase } from "../../../../../lib/pocketbase";
import { isClarificationSubmitRateLimited } from "../../../../../lib/rate-limit";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const prerender = false;

export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  const publicToken = String(params.uuid ?? "").trim();
  if (!publicToken) {
    return json({ ok: false, error: "NOT_FOUND" }, 404);
  }

  const ipAddress = getClientIpFromRequest(request, clientAddress);
  if (isClarificationSubmitRateLimited(ipAddress)) {
    return json({ ok: false, error: "RATE_LIMITED" }, 429);
  }

  let body: { answers?: ClarificationAnswerInput[] };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID" }, 400);
  }

  const answers = Array.isArray(body.answers) ? body.answers : [];
  const normalized: ClarificationAnswerInput[] = answers.map((a) => ({
    itemId: String(a?.itemId ?? ""),
    answerText: String(a?.answerText ?? ""),
  }));

  const userAgent = request.headers.get("user-agent") ?? undefined;

  try {
    const pb = await getSubmissionServicePocketBase();
    await submitClarificationAnswers(pb, {
      publicToken,
      answers: normalized,
      userAgent,
    });
    return json({ ok: true });
  } catch (error) {
    if (error instanceof ClarificationValidationError) {
      return json({ ok: false, error: "INVALID", message: error.message }, 400);
    }
    if (error instanceof ClarificationNotFoundError) {
      return json({ ok: false, error: "NOT_FOUND" }, 404);
    }
    if (error instanceof ClarificationConflictError) {
      return json({ ok: false, error: "ALREADY_SUBMITTED" }, 409);
    }
    if (error instanceof ClarificationGoneError) {
      return json({ ok: false, error: "UNAVAILABLE" }, 409);
    }
    console.error("Clarification submit:", error);
    return json({ ok: false, error: "SERVER_ERROR" }, 500);
  }
};
