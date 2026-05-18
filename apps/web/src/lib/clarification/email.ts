import { Resend } from "resend";

import { requireRuntimeEnv, runtimeEnv } from "../server-env";
import { getApplicationEmailSignOff, getCompanyName } from "../site";
import { CLARIFICATION_LINK_TTL_DAYS } from "./types";

export interface ClarificationCandidateEmailInput {
  to: string;
  candidateName: string;
  jobTitle: string;
  clarificationUrl: string;
  expiresAt: Date;
}

export interface ClarificationAlertEmailInput {
  to: string;
  candidateName: string;
  jobTitle: string;
  recruiterApplicationUrl: string;
}

function formatEmailDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildClarificationCandidateEmailText(input: ClarificationCandidateEmailInput): string {
  const greeting = input.candidateName.trim() ? `Hi ${input.candidateName.trim()},` : "Hi there,";
  const signOff = getApplicationEmailSignOff();

  return `${greeting}

Thanks for applying for ${input.jobTitle}. We reviewed your application and would like to clarify a few details before moving forward.

Please answer the questions using this secure link:
${input.clarificationUrl}

This link will expire on ${formatEmailDate(input.expiresAt)}.

Thank you,
${signOff}`;
}

export function buildClarificationAlertEmailText(input: ClarificationAlertEmailInput): string {
  const name = input.candidateName.trim() || "A candidate";
  return `${name} has completed clarification questions for ${input.jobTitle}.

View the application:
${input.recruiterApplicationUrl}`;
}

export function buildClarificationUrl(publicToken: string): string {
  const base = requireRuntimeEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
  return `${base}/candidate/clarification/${encodeURIComponent(publicToken)}`;
}

export function buildRecruiterApplicationClarificationUrl(applicationId: string): string {
  const base = requireRuntimeEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
  return `${base}/recruiter/applications/${encodeURIComponent(applicationId)}#clarification`;
}

export async function sendClarificationCandidateEmail(
  input: ClarificationCandidateEmailInput,
): Promise<string | null> {
  const resend = new Resend(requireRuntimeEnv("RESEND_API_KEY"));

  const response = await resend.emails.send({
    from: requireRuntimeEnv("APPLICATION_EMAIL_FROM"),
    replyTo: requireRuntimeEnv("APPLICATION_EMAIL_REPLY_TO"),
    to: input.to,
    subject: "A few follow-up questions about your application",
    text: buildClarificationCandidateEmailText(input),
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.id ?? null;
}

export async function sendClarificationCompletedAlert(
  input: ClarificationAlertEmailInput,
): Promise<string | null> {
  const alertsEmail = runtimeEnv("MINIHIRE_SYSTEM_ALERTS_EMAIL");
  if (!alertsEmail) {
    console.warn(
      "MINIHIRE_SYSTEM_ALERTS_EMAIL is unset; skipping clarification completed alert email.",
    );
    return null;
  }

  const resend = new Resend(requireRuntimeEnv("RESEND_API_KEY"));
  const candidateLabel = input.candidateName.trim() || "Candidate";

  const response = await resend.emails.send({
    from: requireRuntimeEnv("APPLICATION_EMAIL_FROM"),
    to: alertsEmail,
    subject: `Clarification completed: ${candidateLabel} for ${input.jobTitle}`,
    text: buildClarificationAlertEmailText({ ...input, to: alertsEmail }),
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.id ?? null;
}

export function defaultClarificationExpiresAt(sentAt: Date): Date {
  const expires = new Date(sentAt);
  expires.setDate(expires.getDate() + CLARIFICATION_LINK_TTL_DAYS);
  return expires;
}

export function getCompanyNameForClarification(): string {
  return getCompanyName();
}
