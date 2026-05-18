import type PocketBase from "pocketbase";

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export type ClarificationEmailTemplate =
  | "clarification_request"
  | "clarification_completed_alert";

export async function createClarificationEmailLog(
  pb: PocketBase,
  input: {
    applicationId: string;
    clarificationRequestId: string;
    template: ClarificationEmailTemplate;
    recipient: string;
    status: "sent" | "failed";
    providerMessageId?: string | null;
    errorMessage?: string;
  },
): Promise<string> {
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

export async function findActiveClarificationRequest(
  pb: PocketBase,
  applicationId: string,
): Promise<import("./types").ClarificationRequestRecord | null> {
  const aid = escapeFilterValue(applicationId);
  try {
    return await pb.collection("clarification_requests").getFirstListItem(
      `application = "${aid}" && (status = "sent" || status = "opened")`,
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return null;
    }
    throw error;
  }
}
