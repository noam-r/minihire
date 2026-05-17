import type { LogisticsFinding } from "../ai/validation/assess-application-logistics";

const MAX_SECONDARY = 3;

function normalizeForDedup(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function isNearDuplicate(a: string, b: string): boolean {
  const na = normalizeForDedup(a);
  const nb = normalizeForDedup(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(" ").filter((w) => w.length > 4));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 4));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap >= 4;
}

function dedupeAgainstFindings(items: string[], findings: LogisticsFinding[]): string[] {
  const findingTexts = findings.flatMap((f) => [f.title, f.detail, `${f.title}: ${f.detail}`]);
  return items.filter(
    (item) => !findingTexts.some((ft) => isNearDuplicate(item, ft)),
  );
}

export function buildEvidenceDigest(input: {
  logisticsFindings: LogisticsFinding[];
  modelConcerns: string[];
  strengths: string[];
  gaps: string[];
  concerns: string[];
}): {
  criticalFindings: LogisticsFinding[];
  secondaryConcerns: string[];
  strengths: string[];
  gaps: string[];
  concerns: string[];
} {
  const logisticsCritical = input.logisticsFindings.filter(
    (f) => f.severity === "deal_breaker" || f.severity === "warning",
  );

  const modelCriticalConcerns = input.modelConcerns.filter((c) => {
    const lower = c.toLowerCase();
    return (
      lower.includes("location") ||
      lower.includes("relocate") ||
      lower.includes("on-site") ||
      lower.includes("onsite") ||
      lower.includes("hybrid") ||
      lower.includes("work authorization") ||
      lower.includes("phone") ||
      lower.includes("timezone")
    );
  });

  const dedupedModelCritical = dedupeAgainstFindings(modelCriticalConcerns, input.logisticsFindings);
  const modelAsFindings: LogisticsFinding[] = dedupedModelCritical.slice(0, 2).map((concern, i) => ({
    severity: "warning" as const,
    code: `model_concern_${i}`,
    title: "Assessment concern",
    detail: concern,
  }));

  const criticalFindings = [...logisticsCritical, ...modelAsFindings];

  const remainingConcerns = dedupeAgainstFindings(
    input.concerns,
    [...input.logisticsFindings, ...modelAsFindings],
  );

  return {
    criticalFindings,
    secondaryConcerns: remainingConcerns.slice(0, MAX_SECONDARY),
    strengths: dedupeAgainstFindings(input.strengths, criticalFindings).slice(0, MAX_SECONDARY),
    gaps: dedupeAgainstFindings(input.gaps, criticalFindings).slice(0, MAX_SECONDARY),
    concerns: remainingConcerns.slice(0, MAX_SECONDARY),
  };
}

export function truncateVerdict(text: string, maxLen = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}
