import type { RecordModel } from "pocketbase";

export const CLARIFICATION_REQUEST_STATUSES = [
  "sent",
  "opened",
  "submitted",
  "expired",
  "cancelled",
] as const;

export type ClarificationRequestStatus = (typeof CLARIFICATION_REQUEST_STATUSES)[number];

export const CLARIFICATION_ITEM_SOURCES = [
  "ai_suggested",
  "recruiter_edited",
  "recruiter_added",
] as const;

export type ClarificationItemSource = (typeof CLARIFICATION_ITEM_SOURCES)[number];

export const APPLICATION_CLARIFICATION_STATUSES = [
  "none",
  "requested",
  "seen",
  "answered",
  "expired",
  "cancelled",
] as const;

export type ApplicationClarificationStatus = (typeof APPLICATION_CLARIFICATION_STATUSES)[number];

export type ClarificationRequestRecord = RecordModel & {
  public_token: string;
  application: string;
  job?: string;
  job_title: string;
  candidate_email: string;
  candidate_name?: string;
  status: ClarificationRequestStatus;
  created_by: string;
  sent_at?: string;
  seen_at?: string;
  submitted_at?: string;
  expires_at: string;
  candidate_email_sent_at?: string;
  candidate_email_log?: string;
  alert_email_sent_at?: string;
  alert_email_log?: string;
  submitted_user_agent?: string;
  seen_user_agent?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancel_reason?: string;
  expand?: {
    created_by?: RecordModel & { email?: string; name?: string };
  };
};

export type ClarificationItemRecord = RecordModel & {
  request: string;
  position: number;
  question_text: string;
  answer_text?: string;
  source: ClarificationItemSource;
  answered_at?: string;
};

export type ClarificationQuestionInput = {
  text: string;
  source: ClarificationItemSource;
};

export type ClarificationAnswerInput = {
  itemId: string;
  answerText: string;
};

export const ACTIVE_CLARIFICATION_STATUSES: ClarificationRequestStatus[] = ["sent", "opened"];

export const CLARIFICATION_LINK_TTL_DAYS = 14;
