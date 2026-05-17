/** PocketBase storage cap for AI artifact text fields (see migration 1747067200). */
export const PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS = 100_000;

/** Default PocketBase text max before migration 1747067200 is loaded by a running server. */
export const PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS = 5_000;

/** @deprecated Use PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS */
export const CV_EXTRACTED_MARKDOWN_STORAGE_MAX_CHARS = PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS;

/** @deprecated Use PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS */
export const CV_EXTRACTED_MARKDOWN_LEGACY_PB_MAX_CHARS = PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS;

const LLM_TRUNCATION_SUFFIX = "\n\n[truncated for model context limit]";
const STORAGE_TRUNCATION_SUFFIX = "\n\n---\n\n_[Truncated for storage.]_";

function truncateToMax(text: string, maxChars: number, suffix: string): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  const sliceLen = Math.max(0, maxChars - suffix.length);
  return {
    text: `${text.slice(0, sliceLen)}${suffix}`,
    truncated: true,
  };
}

export function truncateForLlm(text: string, maxChars: number): { text: string; truncated: boolean } {
  return truncateToMax(text, maxChars, LLM_TRUNCATION_SUFFIX);
}

export function truncateForStorage(text: string, maxChars: number): { text: string; truncated: boolean } {
  return truncateToMax(text, maxChars, STORAGE_TRUNCATION_SUFFIX);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}
