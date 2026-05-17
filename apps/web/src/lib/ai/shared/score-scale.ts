/** CV fit and per-requirement suggested scores use a 0–5 scale. */
export const AI_SCORE_MAX = 5;

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(AI_SCORE_MAX, Math.max(0, value));
}

export function scorePercent(value: number): number {
  return (clampScore(value) / AI_SCORE_MAX) * 100;
}

export function formatScoreFraction(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${clampScore(value).toFixed(1)} / ${AI_SCORE_MAX}`;
}

/** Bold numeric scores in export markdown (PDF has no score bars). */
export function emphasizeScoresInExportMarkdown(markdown: string): string {
  return markdown.replace(/(\d+\.\d+) \/ 5\b/g, "**$1** / 5");
}
