import type { RecruiterCandidateEmailType } from "./types";

export type CandidateEmailTemplateInput = {
  candidateName: string;
  jobTitle: string;
};

export function defaultCandidateEmailSubject(
  type: RecruiterCandidateEmailType,
  input: CandidateEmailTemplateInput,
): string {
  const jobTitle = input.jobTitle.trim() || "your application";
  switch (type) {
    case "rejection":
      return `Update on your application for ${jobTitle}`;
    case "free_text_clarification":
      return `Question about your application for ${jobTitle}`;
  }
}

export function defaultCandidateEmailBody(
  type: RecruiterCandidateEmailType,
  input: CandidateEmailTemplateInput,
): string {
  const jobTitle = input.jobTitle.trim() || "the role";
  switch (type) {
    case "rejection":
      return `Thank you for taking the time to apply for the ${jobTitle} role and for your interest in joining our team.

After careful review, we have decided not to move forward with your application at this time. We appreciate the effort you put into your application and wish you the best in your job search.`;
    case "free_text_clarification":
      return `Thank you for applying for the ${jobTitle} role. We are reviewing your application and would like to clarify a few details before moving forward.

Please reply to this email with any information you can share.`;
  }
}
