const DEFAULT = "/recruiter";
const MAX_LEN = 2048;

/**
 * Restricts open redirects after login to same-site recruiter paths only.
 */
export function sanitizeRecruiterNext(raw: string | null | undefined): string {
  if (raw == null) {
    return DEFAULT;
  }
  const next = raw.trim();
  if (!next || next.length > MAX_LEN) {
    return DEFAULT;
  }
  if (next.startsWith("//")) {
    return DEFAULT;
  }

  const q = next.indexOf("?");
  const path = q === -1 ? next : next.slice(0, q);
  const search = q === -1 ? "" : next.slice(q);

  if (!path.startsWith("/") || !path.startsWith("/recruiter")) {
    return DEFAULT;
  }
  if (path === "/recruiter/login" || path.startsWith("/recruiter/login/")) {
    return DEFAULT;
  }

  return path + search;
}
