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
import {
  createClarificationEmailLog,
  findActiveClarificationRequest,
  findUndeliveredClarificationRequest,
} from "./email-logs";
import {
  applicationStatusFromRequest,
  clarificationEmailWasSent,
  effectiveClarificationRequestStatus,
  isActiveClarificationStatus,
  isClarificationExpired,
  isUndeliveredClarificationRequest,
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
export { findActiveClarificationRequest, findUndeliveredClarificationRequest } from "./email-logs";

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

async function cancelClarificationRequest(
  pb: PocketBase,
  requestId: string,
  reason: string,
  now = new Date(),
): Promise<void> {
  const cancelledAt = toIso(now);
  const updated = await pb.collection("clarification_requests").update<ClarificationRequestRecord>(
    requestId,
    {
      status: "cancelled",
      cancelled_at: cancelledAt,
      cancel_reason: reason,
    },
  );
  await updateApplicationClarificationSummary(pb, updated.application, updated, now);
}

async function finalizeCandidateEmailSend(
  pb: PocketBase,
  input: {
    request: ClarificationRequestRecord;
    applicationId: string;
    email: string;
    candidateName: string;
    jobTitle: string;
    publicToken: string;
    expiresAt: string;
    sentAt: string;
  },
): Promise<ClarificationRequestRecord> {
  const clarificationUrl = buildClarificationUrl(input.publicToken);
  const providerMessageId = await sendClarificationCandidateEmail({
    to: input.email,
    candidateName: input.candidateName,
    jobTitle: input.jobTitle,
    clarificationUrl,
    expiresAt: new Date(input.expiresAt),
  });

  let emailLogId: string | undefined;
  try {
    emailLogId = await createClarificationEmailLog({
      applicationId: input.applicationId,
      clarificationRequestId: input.request.id,
      template: "clarification_request",
      recipient: input.email,
      status: "sent",
      providerMessageId,
    });
  } catch (logError) {
    console.error("Clarification email log (sent) failed:", logError);
  }

  const updated = await pb.collection("clarification_requests").update<ClarificationRequestRecord>(
    input.request.id,
    {
      status: "sent",
      sent_at: input.sentAt,
      candidate_email_sent_at: input.sentAt,
      ...(emailLogId ? { candidate_email_log: emailLogId } : {}),
    },
  );

  await updateApplicationClarificationSummary(pb, input.applicationId, updated);
  return updated;
}

/** Cancel in-flight requests that never got questions or email (e.g. failed mid-create). */
export async function reconcileUndeliveredClarificationRequests(
  pb: PocketBase,
  applicationId: string,
  now = new Date(),
): Promise<void> {
  const aid = escapeFilterValue(applicationId);
  const rows = await pb.collection("clarification_requests").getFullList<ClarificationRequestRecord>({
    filter: `application = "${aid}" && (status = "sent" || status = "opened")`,
  });

  for (const row of rows) {
    if (!isUndeliveredClarificationRequest(row)) {
      continue;
    }
    const items = await listClarificationItemsForRequest(pb, row.id);
    if (items.length === 0) {
      await cancelClarificationRequest(pb, row.id, "candidate_email_failed", now);
    }
  }
}

export async function resendClarificationRequestEmail(
  pb: PocketBase,
  requestId: string,
): Promise<ClarificationRequestRecord> {
  let request: ClarificationRequestRecord;
  try {
    request = await pb.collection("clarification_requests").getOne<ClarificationRequestRecord>(requestId);
  } catch {
    throw new ClarificationNotFoundError();
  }

  if (!isUndeliveredClarificationRequest(request)) {
    throw new ClarificationConflictError("Clarification email was already sent for this request");
  }

  const items = await listClarificationItemsForRequest(pb, request.id);
  if (!items.length) {
    throw new ClarificationConflictError("Clarification request has no questions");
  }

  const now = new Date();
  const sentAt = toIso(now);

  try {
    return await finalizeCandidateEmailSend(pb, {
      request,
      applicationId: request.application,
      email: request.candidate_email,
      candidateName: String(request.candidate_name ?? ""),
      jobTitle: String(request.job_title ?? ""),
      publicToken: request.public_token,
      expiresAt: request.expires_at,
      sentAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Clarification resend email failed:", message);
    try {
      await createClarificationEmailLog({
        applicationId: request.application,
        clarificationRequestId: request.id,
        template: "clarification_request",
        recipient: request.candidate_email,
        status: "failed",
        errorMessage: message,
      });
    } catch (logError) {
      console.error("Failed to log clarification resend failure:", logError);
    }
    throw error;
  }
}

export async function cancelUndeliveredClarificationRequest(
  pb: PocketBase,
  requestId: string,
): Promise<void> {
  let request: ClarificationRequestRecord;
  try {
    request = await pb.collection("clarification_requests").getOne<ClarificationRequestRecord>(requestId);
  } catch {
    throw new ClarificationNotFoundError();
  }

  if (!isUndeliveredClarificationRequest(request)) {
    throw new ClarificationConflictError("Only undelivered clarification requests can be cancelled");
  }

  await cancelClarificationRequest(pb, request.id, "candidate_email_failed", new Date());
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
  // No API sort: collection has no autodate `created` field (PocketBase returns 400 on invalid sort).
  const rows = await pb.collection("clarification_requests").getFullList<ClarificationRequestRecord>({
    filter: `application = "${aid}"`,
  });
  return rows.sort((a, b) => {
    const ta = Date.parse(String(a.sent_at ?? ""));
    const tb = Date.parse(String(b.sent_at ?? ""));
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
      return tb - ta;
    }
    return b.id.localeCompare(a.id);
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
  await reconcileUndeliveredClarificationRequests(pb, input.applicationId);

  const active = await findActiveClarificationRequest(pb, input.applicationId);
  if (active) {
    throw new ClarificationConflictError("Active clarification request already exists");
  }

  const undelivered = await findUndeliveredClarificationRequest(pb, input.applicationId);
  if (undelivered) {
    throw new ClarificationConflictError(
      "An undelivered clarification request already exists; resend or cancel it first",
    );
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

  let request: ClarificationRequestRecord | undefined;
  try {
    request = await pb.collection("clarification_requests").create<ClarificationRequestRecord>({
      public_token: publicToken,
      application: input.applicationId,
      job: jobId || undefined,
      job_title: jobTitle,
      candidate_email: email,
      candidate_name: String(application.full_name ?? "").trim() || "",
      status: "sent",
      created_by: input.actorUserId,
      expires_at: expiresAt,
    });

    // PocketBase treats 0 as blank for required number fields — use 1-based positions.
    for (let index = 0; index < normalized.length; index++) {
      const q = normalized[index]!;
      await pb.collection("clarification_items").create({
        request: request.id,
        position: index + 1,
        question_text: q.text,
        source: q.source,
      });
    }

    return await finalizeCandidateEmailSend(pb, {
      request,
      applicationId: input.applicationId,
      email,
      candidateName: String(application.full_name ?? ""),
      jobTitle,
      publicToken,
      expiresAt,
      sentAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Clarification candidate email failed:", message);

    if (request) {
      try {
        await createClarificationEmailLog({
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

      try {
        await cancelClarificationRequest(pb, request.id, "candidate_email_failed", now);
      } catch (cancelError) {
        console.error("Failed to cancel undelivered clarification request:", cancelError);
      }
    }

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

  if (!clarificationEmailWasSent(request)) {
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
  if (!clarificationEmailWasSent(request)) {
    throw new ClarificationGoneError();
  }

  const items = await listClarificationItemsForRequest(pb, request.id);
  const answerMap = validateClarificationAnswers(items, input.answers);
  const submittedAt = toIso(now);

  for (const item of items) {
    const answerText = answerMap.get(item.id) ?? "";
    await pb.collection("clarification_items").update(item.id, {
      answer_text: answerText,
      answered_at: answerText ? submittedAt : "",
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
      const emailLogId = await createClarificationEmailLog({
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
        await createClarificationEmailLog({
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
