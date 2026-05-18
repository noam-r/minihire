import type {
  ApplicationClarificationStatus,
  ClarificationRequestRecord,
  ClarificationRequestStatus,
} from "./types";
import { ACTIVE_CLARIFICATION_STATUSES } from "./types";

export function isClarificationExpired(request: Pick<ClarificationRequestRecord, "expires_at">, now = new Date()): boolean {
  const expires = Date.parse(String(request.expires_at ?? ""));
  return Number.isFinite(expires) && expires < now.getTime();
}

export function isActiveClarificationStatus(status: ClarificationRequestStatus): boolean {
  return ACTIVE_CLARIFICATION_STATUSES.includes(status);
}

export function effectiveClarificationRequestStatus(
  request: ClarificationRequestRecord,
  now = new Date(),
): ClarificationRequestStatus {
  if (
    isClarificationExpired(request, now) &&
    (request.status === "sent" || request.status === "opened")
  ) {
    return "expired";
  }
  return request.status;
}

export function applicationStatusFromRequest(
  request: ClarificationRequestRecord,
  now = new Date(),
): ApplicationClarificationStatus {
  const status = effectiveClarificationRequestStatus(request, now);
  switch (status) {
    case "sent":
      return "requested";
    case "opened":
      return "seen";
    case "submitted":
      return "answered";
    case "expired":
      return "expired";
    case "cancelled":
      return "cancelled";
    default:
      return "none";
  }
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
