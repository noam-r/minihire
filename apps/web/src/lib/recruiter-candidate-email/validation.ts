export const MAX_CANDIDATE_EMAIL_BODY_LEN = 4000;

export class CandidateEmailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateEmailValidationError";
  }
}

export function validateCandidateEmailBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new CandidateEmailValidationError("Email body is required.");
  }
  if (trimmed.length > MAX_CANDIDATE_EMAIL_BODY_LEN) {
    throw new CandidateEmailValidationError(
      `Email body must be at most ${MAX_CANDIDATE_EMAIL_BODY_LEN} characters.`,
    );
  }
  return trimmed;
}
