import { Resend } from "resend";

import { applicationReceivedEmailPlainText } from "./application-received-copy";
import { requireRuntimeEnv } from "./server-env";
import { getApplicationEmailSignOff } from "./site";

export interface ApplicationEmailInput {
  to: string;
  fullName: string;
  jobTitle: string;
}

export async function sendApplicationReceivedEmail(input: ApplicationEmailInput): Promise<string | null> {
  const resend = new Resend(requireRuntimeEnv("RESEND_API_KEY"));

  const response = await resend.emails.send({
    from: requireRuntimeEnv("APPLICATION_EMAIL_FROM"),
    replyTo: requireRuntimeEnv("APPLICATION_EMAIL_REPLY_TO"),
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
