import { z } from "zod";

import { normalizeValidationModelJson } from "../validation/normalize-validation-output";
import { AiValidationParseError } from "./errors";
import type { ValidationModelOutput } from "./types";

const confidenceSchema = z.enum(["low", "medium", "high"]);
const judgementSchema = z.enum(["supported", "claimed", "partial", "missing", "unclear"]);
const requirementTypeSchema = z.enum(["required", "nice_to_have"]);
const evidenceSourceSchema = z.enum(["cv", "application_field"]);
const strengthSchema = z.enum(["weak", "moderate", "strong"]);

const scoreSchema = z.number().min(0).max(5);

const requirementMatchSchema = z.object({
  requirement: z.string().min(1),
  requirementType: requirementTypeSchema,
  judgement: judgementSchema,
  confidence: confidenceSchema,
  evidence: z
    .array(
      z.object({
        source: evidenceSourceSchema,
        quoteOrSummary: z.string(),
        strength: strengthSchema,
      }),
    )
    .default([]),
  gaps: z.array(z.string()).default([]),
  suggestedScore: scoreSchema,
  reasoning: z.string(),
});

export const validationModelOutputSchema = z.object({
  candidateSummary: z.string(),
  requirementMatches: z.array(requirementMatchSchema),
  overall: z.object({
    strengths: z.array(z.string()).default([]),
    gaps: z.array(z.string()).default([]),
    concerns: z.array(z.string()).default([]),
    suggestedInterviewQuestions: z.array(z.string()).default([]),
    recruiterSummary: z.string(),
    confidence: confidenceSchema,
    confidenceRationale: z.string().min(1),
  }),
});

export function parseValidationModelOutput(raw: string): ValidationModelOutput {
  let json: unknown;
  try {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("No JSON object found in model response");
    }
    json = JSON.parse(trimmed.slice(start, end + 1));
  } catch (error) {
    throw new AiValidationParseError(
      error instanceof Error ? error.message : "Invalid JSON from model",
    );
  }

  const normalized = normalizeValidationModelJson(json);
  const result = validationModelOutputSchema.safeParse(normalized);
  if (!result.success) {
    throw new AiValidationParseError(result.error.message);
  }

  return result.data;
}
