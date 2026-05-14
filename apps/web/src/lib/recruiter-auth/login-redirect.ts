import { sanitizeRecruiterNext } from "./redirect-next";

export type RecruiterLoginQueryError = "csrf" | "invalid" | "portal_profile" | "session";

export function recruiterLoginErrorUrl(error: RecruiterLoginQueryError, nextRaw: string): string {
  const trimmed = nextRaw.trim();
  if (!trimmed) {
    return `/recruiter/login?error=${error}`;
  }
  const safe = sanitizeRecruiterNext(trimmed);
  if (safe === "/recruiter") {
    return `/recruiter/login?error=${error}`;
  }
  return `/recruiter/login?error=${error}&next=${encodeURIComponent(safe)}`;
}

export function recruiterPostLoginRedirect(nextRaw: string): string {
  const trimmed = nextRaw.trim();
  return sanitizeRecruiterNext(trimmed || undefined);
}

/** Destination after a successful login (adds `signed_in=1` for explicit UX on the dashboard). */
export function recruiterPostLoginSuccessUrl(nextRaw: string): string {
  const path = recruiterPostLoginRedirect(nextRaw);
  const u = new URL(path, "http://localhost");
  u.searchParams.set("signed_in", "1");
  return u.pathname + u.search;
}
