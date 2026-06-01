import { getSubmissionServicePocketBase } from "../pocketbase";
import { sanitizeErrorMessage } from "../sanitize";
import type {
  RecruiterCandidateEmailLogRecord,
  RecruiterCandidateEmailLogTemplate,
} from "./types";
import { RECRUITER_CANDIDATE_EMAIL_LOG_TEMPLATES } from "./types";

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

/** `email_logs` may only be created by `submission_service` (see PocketBase rules). */
export async function createRecruiterCandidateEmailLog(input: {
  applicationId: string;
  template: RecruiterCandidateEmailLogTemplate;
  recipient: string;
  status: "sent" | "failed";
  subject: string;
  body: string;
  sentByUserId: string;
  providerMessageId?: string | null;
  errorMessage?: string;
}): Promise<string> {
  const pb = await getSubmissionServicePocketBase();
  const record = await pb.collection("email_logs").create({
    application: input.applicationId,
    template: input.template,
    recipient: input.recipient,
    status: input.status,
    provider: "resend",
    provider_message_id: input.providerMessageId ?? "",
    error_message: input.errorMessage ?? "",
    subject: input.subject,
    body: input.body,
    sent_by: input.sentByUserId,
  });
  return record.id;
}

export async function listRecruiterCandidateEmailsForApplication(
  applicationId: string,
): Promise<RecruiterCandidateEmailLogRecord[]> {
  const pb = await getSubmissionServicePocketBase();
  const aid = escapeFilterValue(applicationId);
  const templateClauses = RECRUITER_CANDIDATE_EMAIL_LOG_TEMPLATES.map((t) => `template = "${t}"`).join(
    " || ",
  );

  const rows = await pb.collection("email_logs").getFullList<RecruiterCandidateEmailLogRecord>({
    filter: `application = "${aid}" && (${templateClauses})`,
  });

  return rows.sort((a, b) => {
    const ta = Date.parse(String(a.created ?? ""));
    const tb = Date.parse(String(b.created ?? ""));
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
      return tb - ta;
    }
    return b.id.localeCompare(a.id);
  });
}

export { sanitizeErrorMessage };
