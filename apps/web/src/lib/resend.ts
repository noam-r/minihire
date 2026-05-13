import { Resend } from "resend";

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
    text: `Hi ${input.fullName},

Thank you for applying for the ${input.jobTitle} role.

This email confirms that we received your application.

Because we are a small team and may receive a large number of applications, we may not be able to reply personally to every candidate. If your background looks like a strong match, we will contact you with next steps.

Thank you again for your interest.

Noam`,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.id ?? null;
}
