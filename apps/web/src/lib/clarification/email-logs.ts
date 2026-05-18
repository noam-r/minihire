import type PocketBase from "pocketbase";

import { getSubmissionServicePocketBase } from "../pocketbase";
import { clarificationEmailWasSent, isUndeliveredClarificationRequest } from "./state";

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export type ClarificationEmailTemplate =
  | "clarification_request"
  | "clarification_completed_alert";

/** `email_logs` may only be created by `submission_service` (see PocketBase rules). */
export async function createClarificationEmailLog(input: {
  applicationId: string;
  clarificationRequestId: string;
  template: ClarificationEmailTemplate;
  recipient: string;
  status: "sent" | "failed";
  providerMessageId?: string | null;
  errorMessage?: string;
}): Promise<string> {
  const pb = await getSubmissionServicePocketBase();
  const record = await pb.collection("email_logs").create({
    application: input.applicationId,
    clarification_request: input.clarificationRequestId,
    template: input.template,
    recipient: input.recipient,
    status: input.status,
    provider: "resend",
    provider_message_id: input.providerMessageId ?? "",
    error_message: input.errorMessage ?? "",
  });
  return record.id;
}

async function listInFlightClarificationRequests(
  pb: PocketBase,
  applicationId: string,
): Promise<import("./types").ClarificationRequestRecord[]> {
  const aid = escapeFilterValue(applicationId);
  return pb.collection("clarification_requests").getFullList({
    filter: `application = "${aid}" && (status = "sent" || status = "opened")`,
  });
}

/** Blocks a new send — email was delivered and candidate may respond. */
export async function findActiveClarificationRequest(
  pb: PocketBase,
  applicationId: string,
): Promise<import("./types").ClarificationRequestRecord | null> {
  const rows = await listInFlightClarificationRequests(pb, applicationId);
  return rows.find((row) => clarificationEmailWasSent(row)) ?? null;
}

/** Created but candidate email never confirmed (retry or cancel). */
export async function findUndeliveredClarificationRequest(
  pb: PocketBase,
  applicationId: string,
): Promise<import("./types").ClarificationRequestRecord | null> {
  const rows = await listInFlightClarificationRequests(pb, applicationId);
  return rows.find((row) => isUndeliveredClarificationRequest(row)) ?? null;
}
