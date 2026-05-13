import { Resend } from "resend";

import { applicationReceivedEmailPlainText } from "./application-received-copy";
import { getApplicationEmailSignOff } from "./site";

function getRequiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export interface ApplicationEmailInput {
  to: string;
  fullName: string;
  jobTitle: string;
}

export async function sendApplicationReceivedEmail(input: ApplicationEmailInput): Promise<string | null> {
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));

  const response = await resend.emails.send({
    from: getRequiredEnv("APPLICATION_EMAIL_FROM"),
    replyTo: getRequiredEnv("APPLICATION_EMAIL_REPLY_TO"),
    to: input.to,
    subject: "Application received",
    text: applicationReceivedEmailPlainText({
      candidateName: input.fullName,
      jobTitle: input.jobTitle,
      signOffFrom: getApplicationEmailSignOff(),
    }),
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.id ?? null;
}
