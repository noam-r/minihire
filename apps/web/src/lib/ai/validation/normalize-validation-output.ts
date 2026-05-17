/**
 * Coerce common LLM JSON shapes into the structure expected by validationModelOutputSchema.
 */
export function normalizeValidationModelJson(json: unknown): unknown {
  const root = asRecord(json);
  if (!root) {
    return json;
  }

  const candidateSummary = normalizeCandidateSummary(
    root.candidateSummary ?? root.candidate_summary,
  );

  const rawMatches = root.requirementMatches ?? root.requirement_matches;
  const requirementMatches = Array.isArray(rawMatches)
    ? rawMatches.map((match) => normalizeRequirementMatch(match))
    : [];

  const overall = normalizeOverall(root.overall);

  return {
    candidateSummary,
    requirementMatches,
    overall,
  };
}

function normalizeCandidateSummary(value: unknown): string {
  const direct = pickString(value);
  if (direct) {
    return direct;
  }

  const rec = asRecord(value);
  if (!rec) {
    return value == null ? "" : String(value);
  }

  const fromFields = pickString(
    rec.summary,
    rec.overview,
    rec.text,
    rec.description,
    rec.candidateSummary,
    rec.candidate_summary,
  );
  if (fromFields) {
    return fromFields;
  }

  const highlights = rec.highlights ?? rec.strengths ?? rec.keyPoints ?? rec.key_points;
  if (Array.isArray(highlights)) {
    const parts = highlights.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return JSON.stringify(rec);
}

function normalizeRequirementMatch(match: unknown): Record<string, unknown> {
  const rec = asRecord(match);
  if (!rec) {
    return {};
  }

  const requirementType = normalizeRequirementType(rec.requirementType ?? rec.requirement_type);
  const judgement = normalizeJudgement(rec.judgement ?? rec.judgment);
  const confidence = normalizeConfidence(rec.confidence);

  const reasoning =
    pickString(rec.reasoning, rec.rationale, rec.explanation, rec.reason, rec.notes, rec.analysis) ?? "";

  const evidence = normalizeEvidence(rec.evidence).map((item) => normalizeEvidenceItem(item));

  const gaps = Array.isArray(rec.gaps)
    ? rec.gaps.filter((g): g is string => typeof g === "string")
    : pickString(rec.gap)
      ? [String(rec.gap)]
      : [];

  return {
    requirement: pickString(rec.requirement, rec.name, rec.skill, rec.title) ?? "",
    requirementType,
    judgement,
    confidence,
    evidence,
    gaps,
    suggestedScore: coerceScore(rec.suggestedScore ?? rec.suggested_score ?? rec.score),
    reasoning,
  };
}

function normalizeEvidence(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const rec = asRecord(value);
  if (!rec) {
    if (typeof value === "string" && value.trim()) {
      return [{ source: "cv", quoteOrSummary: value.trim(), strength: "moderate" }];
    }
    return [];
  }

  if (Array.isArray(rec.items)) {
    return rec.items;
  }
  if (Array.isArray(rec.evidence)) {
    return rec.evidence;
  }

  if ("source" in rec || "quoteOrSummary" in rec || "quote" in rec || "summary" in rec || "text" in rec) {
    return [rec];
  }

  const fromFields: unknown[] = [];
  for (const [key, entry] of Object.entries(rec)) {
    if (key === "items" || key === "evidence") {
      continue;
    }
    if (typeof entry === "string" && entry.trim()) {
      fromFields.push({
        source: key === "application_field" || key === "application" ? "application_field" : "cv",
        quoteOrSummary: entry.trim(),
        strength: "moderate",
      });
    }
  }
  if (fromFields.length > 0) {
    return fromFields;
  }

  return [];
}

function normalizeEvidenceItem(item: unknown): Record<string, unknown> {
  const rec = asRecord(item);
  if (!rec) {
    if (typeof item === "string" && item.trim()) {
      return { source: "cv", quoteOrSummary: item.trim(), strength: "moderate" };
    }
    return { source: "cv", quoteOrSummary: "", strength: "moderate" };
  }

  const source = normalizeEvidenceSource(rec.source ?? rec.type);
  const quoteOrSummary =
    pickString(rec.quoteOrSummary, rec.quote_or_summary, rec.quote, rec.summary, rec.text, rec.excerpt) ?? "";

  const strength = normalizeStrength(rec.strength);

  return { source, quoteOrSummary, strength };
}

function normalizeOverall(overall: unknown): Record<string, unknown> {
  const rec = asRecord(overall) ?? {};

  const recruiterSummary =
    pickString(
      rec.recruiterSummary,
      rec.recruiter_summary,
      rec.summary,
      rec.report,
      rec.overview,
      rec.conclusion,
    ) ?? "";

  const confidenceRationale =
    pickString(
      rec.confidenceRationale,
      rec.confidence_rationale,
      rec.confidenceReasoning,
      rec.confidence_reasoning,
    ) ?? "";

  return {
    strengths: stringArray(rec.strengths),
    gaps: stringArray(rec.gaps),
    concerns: stringArray(rec.concerns),
    suggestedInterviewQuestions: stringArray(
      rec.suggestedInterviewQuestions ?? rec.suggested_interview_questions ?? rec.interviewQuestions,
    ),
    recruiterSummary,
    confidence: normalizeConfidence(rec.confidence),
    confidenceRationale,
  };
}

function normalizeRequirementType(value: unknown): string {
  const raw = pickString(value)?.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!raw) {
    return "required";
  }
  if (raw === "nice_to_have" || raw === "nice_to_have_skill" || raw === "preferred" || raw === "optional") {
    return "nice_to_have";
  }
  return "required";
}

function normalizeJudgement(value: unknown): string {
  const raw = pickString(value)?.toLowerCase();
  if (!raw) {
    return "unclear";
  }
  return raw;
}

function normalizeConfidence(value: unknown): string {
  const raw = pickString(value)?.toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high") {
    return raw;
  }
  return "medium";
}

function normalizeEvidenceSource(value: unknown): string {
  const raw = pickString(value)?.toLowerCase();
  if (raw === "application_field" || raw === "application" || raw === "form") {
    return "application_field";
  }
  return "cv";
}

function normalizeStrength(value: unknown): string {
  const raw = pickString(value)?.toLowerCase();
  if (raw === "weak" || raw === "moderate" || raw === "strong") {
    return raw;
  }
  return "moderate";
}

function coerceScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(5, Math.max(0, value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.min(5, Math.max(0, parsed));
    }
  }
  return 0;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
