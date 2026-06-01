import { Resend } from "resend";
import type PocketBase from "pocketbase";

import { syncApplicationStatusChangedAt } from "../ai/pipeline/store-artifacts";
import { requireRuntimeEnv } from "../server-env";
import { buildCandidateEmailPlainText } from "./build-message";
import {
  createRecruiterCandidateEmailLog,
  sanitizeErrorMessage,
} from "./email-logs";
import { defaultCandidateEmailSubject } from "./templates";
import type { RecruiterCandidateEmailType } from "./types";
import { emailLogTemplateForType, isRecruiterCandidateEmailType } from "./types";
import { CandidateEmailValidationError, validateCandidateEmailBody } from "./validation";

export class CandidateEmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateEmailSendError";
  }
}

export class CandidateEmailNotFoundError extends Error {
  constructor() {
    super("Application not found");
    this.name = "CandidateEmailNotFoundError";
  }
}

async function sendPlainTextEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<string | null> {
  const resend = new Resend(requireRuntimeEnv("RESEND_API_KEY"));

  const response = await resend.emails.send({
    from: requireRuntimeEnv("APPLICATION_EMAIL_FROM"),
    replyTo: requireRuntimeEnv("APPLICATION_EMAIL_REPLY_TO"),
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.id ?? null;
}

async function maybeUpdateRejectedStatus(
  pb: PocketBase,
  applicationId: string,
  actorUserId: string,
  currentStatus: string,
): Promise<boolean> {
  if (currentStatus === "rejected") {
    return false;
  }

  await pb.collection("applications").update(applicationId, { status: "rejected" });

  try {
    await pb.collection("application_status_history").create({
      application: applicationId,
      from_status: currentStatus || null,
      to_status: "rejected",
      changed_by: actorUserId,
    });
  } catch (error) {
    console.error("application_status_history create:", error);
  }

  try {
    await syncApplicationStatusChangedAt(pb, applicationId);
  } catch (error) {
    console.error("application status_changed_at sync:", error);
  }

  return true;
}

export type SendRecruiterCandidateEmailInput = {
  applicationId: string;
  actorUserId: string;
  type: RecruiterCandidateEmailType;
  body: string;
  setRejected?: boolean;
};

export type SendRecruiterCandidateEmailResult = {
  providerMessageId: string | null;
  statusUpdated: boolean;
};

export async function sendRecruiterCandidateEmail(
  pb: PocketBase,
  input: SendRecruiterCandidateEmailInput,
): Promise<SendRecruiterCandidateEmailResult> {
  if (!isRecruiterCandidateEmailType(input.type)) {
    throw new CandidateEmailValidationError("Invalid email type.");
  }

  const body = validateCandidateEmailBody(input.body);
  const logTemplate = emailLogTemplateForType(input.type);

  let application;
  try {
    application = await pb.collection("applications").getOne(input.applicationId, { expand: "job" });
  } catch {
    throw new CandidateEmailNotFoundError();
  }

  const email = String(application.email ?? "").trim();
  if (!email) {
    throw new CandidateEmailValidationError("Application has no candidate email.");
  }

  const job = application.expand?.job as { title?: string } | undefined;
  const jobTitle = String(job?.title ?? "").trim() || "your application";
  const candidateName = String(application.full_name ?? "").trim();

  const subject = defaultCandidateEmailSubject(input.type, { candidateName, jobTitle });
  const plainText = buildCandidateEmailPlainText({ candidateName, body });

  let providerMessageId: string | null = null;
  try {
    providerMessageId = await sendPlainTextEmail({ to: email, subject, text: plainText });
    await createRecruiterCandidateEmailLog({
      applicationId: input.applicationId,
      template: logTemplate,
      recipient: email,
      status: "sent",
      subject,
      body: plainText,
      sentByUserId: input.actorUserId,
      providerMessageId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await createRecruiterCandidateEmailLog({
        applicationId: input.applicationId,
        template: logTemplate,
        recipient: email,
        status: "failed",
        subject,
        body: plainText,
        sentByUserId: input.actorUserId,
        errorMessage: sanitizeErrorMessage(message),
      });
    } catch (logError) {
      console.error("Recruiter candidate email log (failed) failed:", logError);
    }
    throw new CandidateEmailSendError(message);
  }

  let statusUpdated = false;
  if (input.type === "rejection" && input.setRejected) {
    statusUpdated = await maybeUpdateRejectedStatus(
      pb,
      input.applicationId,
      input.actorUserId,
      String(application.status ?? ""),
    );
  }

  return { providerMessageId, statusUpdated };
}
