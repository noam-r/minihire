/** Labels and placeholders for recruiter-facing application detail views. */

export const NOT_PROVIDED = "Not provided";
export const NA = "N/A";

/** Exported for callers that need raw trimmed strings (e.g. job titles). */
export function trimStr(v: unknown): string {
  if (v == null || v === undefined) {
    return "";
  }
  return String(v).trim();
}

/** Optional applicant text / URL stored as empty string when omitted. */
export function optionalApplicantText(v: unknown): string {
  const s = trimStr(v);
  return s !== "" ? s : NOT_PROVIDED;
}

/** Public URL field: return trimmed URL or null when absent. */
export function optionalApplicantUrl(v: unknown): string | null {
  const s = trimStr(v);
  return s !== "" ? s : null;
}

export function requiredApplicantText(v: unknown): string {
  const s = trimStr(v);
  return s !== "" ? s : "—";
}

export function formatConsent(v: unknown): string {
  if (v === true) {
    return "Yes";
  }
  if (v === false) {
    return "No";
  }
  return NA;
}

/** PocketBase single-file field: string filename, or legacy array. */
export function cvFilename(v: unknown): string {
  if (Array.isArray(v)) {
    const joined = v.map((x) => trimStr(x)).filter(Boolean).join(", ");
    return joined !== "" ? joined : NOT_PROVIDED;
  }
  const s = trimStr(v);
  return s !== "" ? s : NOT_PROVIDED;
}

export function formatSubmittedAt(v: unknown): string {
  const s = trimStr(v);
  if (!s) {
    return NA;
  }
  return s.length >= 19 ? s.slice(0, 19).replace("T", " ") : s;
}
