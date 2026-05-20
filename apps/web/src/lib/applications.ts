import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";

import { normalizeEmail } from "./sanitize";

export type ApplicationRecord = RecordModel & {
  job: string;
  full_name: string;
  email: string;
  status: string;
  duplicate_key: string;
  submitted_at?: string;
  status_changed_at?: string;
  cv_fit_score?: number | null;
  required_skills_score?: number | null;
  nice_to_have_score?: number | null;
  ai_evaluated_at?: string;
  clarification_status?: string;
  clarification_requested_at?: string;
  clarification_seen_at?: string;
  clarification_answered_at?: string;
  starred?: boolean;
};

export function buildDuplicateKey(email: string, jobId: string): string {
  return `${normalizeEmail(email)}:${jobId}`;
}

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export async function findApplicationByDuplicateKey(
  pb: PocketBase,
  duplicateKey: string,
): Promise<ApplicationRecord | null> {
  try {
    return await pb.collection("applications").getFirstListItem<ApplicationRecord>(
      `duplicate_key = "${escapeFilterValue(duplicateKey)}"`,
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function hasSuccessfulConfirmationEmail(
  pb: PocketBase,
  applicationId: string,
): Promise<boolean> {
  try {
    await pb.collection("email_logs").getFirstListItem(
      `application = "${escapeFilterValue(applicationId)}" && template = "application_received" && status = "sent"`,
    );
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return false;
    }

    throw error;
  }
}

export async function createEmailLog(
  pb: PocketBase,
  input: {
    applicationId: string;
    recipient: string;
    status: "sent" | "failed";
    providerMessageId?: string | null;
    errorMessage?: string;
  },
): Promise<void> {
  await pb.collection("email_logs").create({
    application: input.applicationId,
    template: "application_received",
    recipient: input.recipient,
    status: input.status,
    provider: "resend",
    provider_message_id: input.providerMessageId ?? "",
    error_message: input.errorMessage ?? "",
  });
}
