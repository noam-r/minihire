export const RECRUITER_CANDIDATE_EMAIL_TYPES = ["rejection", "free_text_clarification"] as const;

export type RecruiterCandidateEmailType = (typeof RECRUITER_CANDIDATE_EMAIL_TYPES)[number];

export type RecruiterCandidateEmailLogTemplate =
  | "application_rejected"
  | "free_text_clarification";

const TYPE_TO_LOG_TEMPLATE: Record<RecruiterCandidateEmailType, RecruiterCandidateEmailLogTemplate> = {
  rejection: "application_rejected",
  free_text_clarification: "free_text_clarification",
};

export function isRecruiterCandidateEmailType(value: string): value is RecruiterCandidateEmailType {
  return (RECRUITER_CANDIDATE_EMAIL_TYPES as readonly string[]).includes(value);
}

export function emailLogTemplateForType(
  type: RecruiterCandidateEmailType,
): RecruiterCandidateEmailLogTemplate {
  return TYPE_TO_LOG_TEMPLATE[type];
}

export const RECRUITER_CANDIDATE_EMAIL_LOG_TEMPLATES = [
  "application_rejected",
  "free_text_clarification",
] as const;

export type RecruiterCandidateEmailLogRecord = {
  id: string;
  application: string;
  template: RecruiterCandidateEmailLogTemplate;
  recipient: string;
  status: "sent" | "failed";
  subject?: string;
  body?: string;
  sent_by?: string;
  created?: string;
  error_message?: string;
};

export function formatRecruiterCandidateEmailTypeLabel(type: RecruiterCandidateEmailType): string {
  switch (type) {
    case "rejection":
      return "Rejection";
    case "free_text_clarification":
      return "Free-text clarification";
  }
}

export function formatRecruiterCandidateEmailLogLabel(template: string): string {
  switch (template) {
    case "application_rejected":
      return "Rejection";
    case "free_text_clarification":
      return "Free-text clarification";
    default:
      return template.replaceAll("_", " ");
  }
}
