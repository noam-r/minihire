import type PocketBase from "pocketbase";

import { runtimeEnv } from "../server-env";
import { getSuggestedClarificationQuestions } from "./ai-suggestions";
import {
  buildClarificationUrl,
  buildRecruiterApplicationClarificationUrl,
  defaultClarificationExpiresAt,
  sendClarificationCandidateEmail,
  sendClarificationCompletedAlert,
} from "./email";
import { createClarificationEmailLog, findActiveClarificationRequest } from "./email-logs";
import {
  applicationStatusFromRequest,
  effectiveClarificationRequestStatus,
  isActiveClarificationStatus,
  isClarificationExpired,
} from "./state";
import { generateClarificationPublicToken } from "./tokens";
import type {
  ClarificationAnswerInput,
  ClarificationItemRecord,
  ClarificationQuestionInput,
  ClarificationRequestRecord,
} from "./types";
import {
  normalizeQuestionSources,
  validateClarificationAnswers,
  validateClarificationQuestions,
} from "./validation";

export { getSuggestedClarificationQuestions } from "./ai-suggestions";
export { findActiveClarificationRequest } from "./email-logs";

export class ClarificationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClarificationConflictError";
  }
}

export class ClarificationNotFoundError extends Error {
  constructor() {
    super("Clarification request not found");
    this.name = "ClarificationNotFoundError";
  }
}

export class ClarificationGoneError extends Error {
  constructor() {
    super("Clarification link is no longer available");
    this.name = "ClarificationGoneError";
  }
}

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function toIso(date: Date): string {
  return date.toISOString();
}

async function updateApplicationClarificationSummary(
  pb: PocketBase,
  applicationId: string,
  request: ClarificationRequestRecord,
  now = new Date(),
): Promise<void> {
  const status = applicationStatusFromRequest(request, now);
  const patch: Record<string, unknown> = {
    latest_clarification_request: request.id,
    clarification_status: status,
  };

  if (status === "requested" && request.sent_at) {
    patch.clarification_requested_at = request.sent_at;
  }
  if (status === "seen" && request.seen_at) {
    patch.clarification_seen_at = request.seen_at;
  }
  if (status === "answered" && request.submitted_at) {
    patch.clarification_answered_at = request.submitted_at;
  }

  await pb.collection("applications").update(applicationId, patch);
}

export async function syncApplicationClarificationExpiry(
  pb: PocketBase,
  applicationId: string,
  requests: ClarificationRequestRecord[],
  now = new Date(),
): Promise<void> {
  const latest = requests[0];
  if (!latest) {
    return;
  }
  const effective = effectiveClarificationRequestStatus(latest, now);
  if (effective !== "expired") {
    return;
  }
  if (isActiveClarificationStatus(latest.status)) {
    await pb.collection("applications").update(applicationId, {
      latest_clarification_request: latest.id,
      clarification_status: "expired",
    });
  }
}

export async function listClarificationRequestsForApplication(
  pb: PocketBase,
  applicationId: string,
): Promise<ClarificationRequestRecord[]> {
  const aid = escapeFilterValue(applicationId);
  const rows = await pb.collection("clarification_requests").getFullList<ClarificationRequestRecord>({
    filter: `application = "${aid}"`,
    expand: "created_by",
    sort: "-sent_at,-created",
  });
  return rows.sort((a, b) => {
    const ta = Date.parse(String(a.sent_at ?? a.created ?? ""));
    const tb = Date.parse(String(b.sent_at ?? b.created ?? ""));
    return tb - ta;
  });
}

export async function listClarificationItemsForRequest(
  pb: PocketBase,
  requestId: string,
): Promise<ClarificationItemRecord[]> {
  const rid = escapeFilterValue(requestId);
  const items = await pb.collection("clarification_items").getFullList<ClarificationItemRecord>({
    filter: `request = "${rid}"`,
    sort: "position",
  });
  return items.sort((a, b) => a.position - b.position);
}

export async function getRequestByPublicToken(
  pb: PocketBase,
  publicToken: string,
): Promise<ClarificationRequestRecord | null> {
  const token = escapeFilterValue(publicToken.trim());
  if (!token) {
    return null;
  }
  try {
    return await pb.collection("clarification_requests").getFirstListItem<ClarificationRequestRecord>(
      `public_token = "${token}"`,
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createAndSendClarificationRequest(
  pb: PocketBase,
  input: {
    applicationId: string;
    actorUserId: string;
    questions: ClarificationQuestionInput[];
  },
): Promise<ClarificationRequestRecord> {
  const active = await findActiveClarificationRequest(pb, input.applicationId);
  if (active) {
    throw new ClarificationConflictError("Active clarification request already exists");
  }

  const aiSuggestions = (await getSuggestedClarificationQuestions(pb, input.applicationId)).map(
    (q) => q.text,
  );
  const normalized = normalizeQuestionSources(
    validateClarificationQuestions(input.questions),
    aiSuggestions,
  );

  let application;
  try {
    application = await pb.collection("applications").getOne(input.applicationId, { expand: "job" });
  } catch {
    throw new ClarificationNotFoundError();
  }

  const email = String(application.email ?? "").trim();
  if (!email) {
    throw new Error("Application has no candidate email");
  }

  const job = application.expand?.job as { id?: string; title?: string } | undefined;
  const jobId = String(application.job ?? job?.id ?? "");
  const jobTitle = String(job?.title ?? "").trim() || "your application";
  const now = new Date();
  const sentAt = toIso(now);
  const expiresAt = toIso(defaultClarificationExpiresAt(now));
  const publicToken = generateClarificationPublicToken();

  const request = await pb.collection("clarification_requests").create<ClarificationRequestRecord>({
    public_token: publicToken,
    application: input.applicationId,
    job: jobId || undefined,
    job_title: jobTitle,
    candidate_email: email,
    candidate_name: String(application.full_name ?? "").trim() || "",
    status: "sent",
    created_by: input.actorUserId,
    sent_at: sentAt,
    expires_at: expiresAt,
  });

  for (let position = 0; position < normalized.length; position++) {
    const q = normalized[position]!;
    await pb.collection("clarification_items").create({
      request: request.id,
      position,
      question_text: q.text,
      source: q.source,
    });
  }

  const clarificationUrl = buildClarificationUrl(publicToken);

  try {
    const providerMessageId = await sendClarificationCandidateEmail({
      to: email,
      candidateName: String(application.full_name ?? ""),
      jobTitle,
      clarificationUrl,
      expiresAt: new Date(expiresAt),
    });

    const emailLogId = await createClarificationEmailLog(pb, {
      applicationId: input.applicationId,
      clarificationRequestId: request.id,
      template: "clarification_request",
      recipient: email,
      status: "sent",
      providerMessageId,
    });

    const updated = await pb.collection("clarification_requests").update<ClarificationRequestRecord>(
      request.id,
      {
        candidate_email_sent_at: sentAt,
        candidate_email_log: emailLogId,
      },
    );

    await updateApplicationClarificationSummary(pb, input.applicationId, updated, now);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Clarification candidate email failed:", message);

    try {
      await createClarificationEmailLog(pb, {
        applicationId: input.applicationId,
        clarificationRequestId: request.id,
        template: "clarification_request",
        recipient: email,
        status: "failed",
        errorMessage: message,
      });
    } catch (logError) {
      console.error("Failed to log clarification email failure:", logError);
    }

    await pb.collection("clarification_requests").update(request.id, {
      status: "cancelled",
      cancelled_at: sentAt,
      cancel_reason: "candidate_email_failed",
    });

    throw error;
  }
}

export type MarkClarificationSeenResult = {
  request: ClarificationRequestRecord;
  items: ClarificationItemRecord[];
  alreadySubmitted: boolean;
  unavailable: boolean;
};

export async function markClarificationSeen(
  pb: PocketBase,
  publicToken: string,
  context?: { userAgent?: string },
): Promise<MarkClarificationSeenResult> {
  const request = await getRequestByPublicToken(pb, publicToken);
  if (!request) {
    throw new ClarificationNotFoundError();
  }

  const items = await listClarificationItemsForRequest(pb, request.id);
  const now = new Date();

  if (request.status === "submitted") {
    return { request, items, alreadySubmitted: true, unavailable: false };
  }

  if (request.status === "cancelled") {
    return { request, items, alreadySubmitted: false, unavailable: true };
  }

  if (isClarificationExpired(request, now)) {
    await syncApplicationClarificationExpiry(pb, request.application, [request], now);
    return { request, items, alreadySubmitted: false, unavailable: true };
  }

  let current = request;

  if (request.status === "sent") {
    const patch: Record<string, unknown> = {
      status: "opened",
      seen_at: request.seen_at ?? toIso(now),
    };
    if (context?.userAgent) {
      patch.seen_user_agent = context.userAgent.slice(0, 500);
    }
    current = await pb.collection("clarification_requests").update<ClarificationRequestRecord>(
      request.id,
      patch,
    );
    await updateApplicationClarificationSummary(pb, request.application, current, now);
  }

  return { request: current, items, alreadySubmitted: false, unavailable: false };
}

export async function submitClarificationAnswers(
  pb: PocketBase,
  input: {
    publicToken: string;
    answers: ClarificationAnswerInput[];
    userAgent?: string;
  },
): Promise<void> {
  const request = await getRequestByPublicToken(pb, input.publicToken);
  if (!request) {
    throw new ClarificationNotFoundError();
  }

  const now = new Date();

  if (request.status === "submitted") {
    throw new ClarificationConflictError("Already submitted");
  }
  if (request.status === "cancelled") {
    throw new ClarificationGoneError();
  }
  if (isClarificationExpired(request, now)) {
    throw new ClarificationGoneError();
  }
  if (request.status !== "sent" && request.status !== "opened") {
    throw new ClarificationConflictError("Invalid request state");
  }

  const items = await listClarificationItemsForRequest(pb, request.id);
  const answerMap = validateClarificationAnswers(items, input.answers);
  const submittedAt = toIso(now);

  for (const item of items) {
    const answerText = answerMap.get(item.id)!;
    await pb.collection("clarification_items").update(item.id, {
      answer_text: answerText,
      answered_at: submittedAt,
    });
  }

  const patch: Record<string, unknown> = {
    status: "submitted",
    submitted_at: submittedAt,
  };
  if (input.userAgent) {
    patch.submitted_user_agent = input.userAgent.slice(0, 500);
  }

  const updated = await pb.collection("clarification_requests").update<ClarificationRequestRecord>(
    request.id,
    patch,
  );

  await updateApplicationClarificationSummary(pb, request.application, updated, now);

  try {
    const providerMessageId = await sendClarificationCompletedAlert({
      to: "",
      candidateName: String(request.candidate_name ?? ""),
      jobTitle: String(request.job_title ?? ""),
      recruiterApplicationUrl: buildRecruiterApplicationClarificationUrl(request.application),
    });

    const alertsEmail = runtimeEnv("MINIHIRE_SYSTEM_ALERTS_EMAIL");
    if (providerMessageId && alertsEmail) {
      const emailLogId = await createClarificationEmailLog(pb, {
        applicationId: request.application,
        clarificationRequestId: request.id,
        template: "clarification_completed_alert",
        recipient: alertsEmail,
        status: "sent",
        providerMessageId,
      });
      await pb.collection("clarification_requests").update(request.id, {
        alert_email_sent_at: submittedAt,
        alert_email_log: emailLogId,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Clarification alert email failed:", message);
    try {
      const alertsEmail = runtimeEnv("MINIHIRE_SYSTEM_ALERTS_EMAIL");
      if (alertsEmail) {
        await createClarificationEmailLog(pb, {
          applicationId: request.application,
          clarificationRequestId: request.id,
          template: "clarification_completed_alert",
          recipient: alertsEmail,
          status: "failed",
          errorMessage: message,
        });
      }
    } catch (logError) {
      console.error("Failed to log clarification alert email failure:", logError);
    }
  }
}
