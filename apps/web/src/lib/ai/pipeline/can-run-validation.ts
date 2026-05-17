import type { NormalizedApplication } from "../shared/types";

export function canRunValidation(normalized: NormalizedApplication): boolean {
  return (
    normalized.cv.extractionStatus === "success" && Boolean(normalized.cv.extractedMarkdown.trim())
  );
}

export const VALIDATION_SKIP_REASON =
  "AI validation skipped because no readable Markdown CV is available.";
