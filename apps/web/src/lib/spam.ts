import { createHmac, timingSafeEqual } from "node:crypto";

export const HONEYPOT_FIELD_NAME = "company_website";
export const FORM_STARTED_AT_FIELD = "form_started_at";
export const FORM_SIGNATURE_FIELD = "form_signature";
const MIN_FORM_COMPLETION_MS = 4_000;

function getSigningSecret(): string {
  const secret = import.meta.env.FORM_SIGNING_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: FORM_SIGNING_SECRET");
  }

  return secret;
}

function sign(jobSlug: string, startedAt: string): string {
  return createHmac("sha256", getSigningSecret()).update(`${jobSlug}:${startedAt}`).digest("hex");
}

export function createSignedFormState(jobSlug: string) {
  const startedAt = String(Date.now());

  return {
    startedAt,
    signature: sign(jobSlug, startedAt),
  };
}

export function isSuspiciousSubmission(jobSlug: string, formData: FormData): boolean {
  const honeypot = formData.get(HONEYPOT_FIELD_NAME);

  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return true;
  }

  const startedAt = formData.get(FORM_STARTED_AT_FIELD);
  const signature = formData.get(FORM_SIGNATURE_FIELD);

  if (typeof startedAt !== "string" || typeof signature !== "string") {
    return true;
  }

  const startedAtNumber = Number(startedAt);

  if (!Number.isFinite(startedAtNumber) || startedAtNumber <= 0) {
    return true;
  }

  const expectedSignature = sign(jobSlug, startedAt);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return true;
  }

  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    return true;
  }

  return Date.now() - startedAtNumber < MIN_FORM_COMPLETION_MS;
}
