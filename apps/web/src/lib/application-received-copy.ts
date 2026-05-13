/** Shared wording for the confirmation email and the public thank-you page. */

export const applicationReceivedConfirmationLine =
  "This email confirms that we received your application.";

export const applicationReceivedFollowUpParagraph =
  "Because we are a small team and may receive a large number of applications, we may not be able to reply personally to every candidate. If your background looks like a strong match, we will contact you with next steps.";

export const applicationReceivedClosingLine = "Thank you again for your interest.";

export function applicationReceivedEmailPlainText(input: {
  candidateName: string;
  jobTitle: string;
  signOffFrom: string;
}): string {
  return `Hi ${input.candidateName},

Thank you for applying for the ${input.jobTitle} role.

${applicationReceivedConfirmationLine}

${applicationReceivedFollowUpParagraph}

${applicationReceivedClosingLine}

${input.signOffFrom}`;
}
