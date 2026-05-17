import { VALIDATION_PROMPT_VERSION, VALIDATION_RESPONSE_SCHEMA_VERSION } from "../shared/versions";
import type { NormalizedApplication, NormalizedJob, ValidationPrompt } from "../shared/types";

export function buildValidationPrompt(input: {
  job: NormalizedJob;
  application: NormalizedApplication;
  cvMarkdown: string;
}): ValidationPrompt {
  const jobPayload = {
    id: input.job.jobId,
    title: input.job.title,
    descriptionMarkdown: input.job.descriptionMarkdown,
    requiredSkills: input.job.requiredSkills,
    niceToHaveSkills: input.job.niceToHaveSkills,
    employmentType: input.job.employmentType,
    workModel: input.job.workModel,
    workLocation: input.job.workLocation,
    hiringProcess: input.job.hiringProcess,
  };

  const applicationPayload = {
    id: input.application.applicationId,
    candidate: input.application.candidate,
    cvMarkdown: input.cvMarkdown,
  };

  const system = `You are assisting a human recruiter.
Evaluate the candidate application against the job requirements.
Return strict JSON only matching the required schema.
Do not make a hiring decision.
Do not recommend automatic rejection.
Do not infer protected characteristics.
Do not use the candidate's name, age, gender, nationality, ethnicity, religion, disability, or family status as evidence.
Distinguish claims from demonstrated evidence.
Use only the provided data.
Report uncertainty.

Coverage (mandatory):
- Emit exactly one requirementMatch row for every string in job.requiredSkills (requirementType "required").
- Emit exactly one requirementMatch row for every string in job.niceToHaveSkills (requirementType "nice_to_have").
- Do not skip nice-to-have items. Do not merge multiple job bullets into one row.
- Copy each requirement text from the job lists verbatim (you may trim a leading "- ").

overall.strengths / overall.gaps / overall.concerns:
- gaps: specific skill or requirement shortfalls.
- concerns: hiring risks a recruiter should probe (e.g. seniority misalignment with a junior role, thin evidence on must-haves, role-motivation questions). Use concerns when material; do not leave concerns empty if the candidate appears over-qualified, under-qualified, or several required items are missing/claimed-only.
- For onsite or hybrid roles: if candidate location, timezone, or phone country clearly conflicts with job.workLocation, add a material concern about relocation, work authorization, or commute feasibility. Treat cross-country mismatch as a serious concern, not a minor note.

Judgement meanings:
- supported: concrete evidence in the CV or application fields
- claimed: stated but limited evidence
- partial: supports only part of the requirement
- missing: no relevant evidence
- unclear: ambiguous or conflicting

Each requirementMatch must use requirementType "required" or "nice_to_have".
suggestedScore must be 0-5. confidence must be low, medium, or high.
evidence must be an array (even for a single item). evidence.source must be "cv" or "application_field".
candidateSummary must be a string (not an object). Each match must include reasoning (string).
overall.recruiterSummary must be a string (high-level narrative for the recruiter).
overall.confidenceRationale must be a string (1-3 sentences): explain why the confidence level is appropriate based on evidence quality (supported vs claimed/missing counts, thin or ambiguous CV). Do not repeat the confidence label alone or duplicate recruiterSummary verbatim.

Response JSON shape (use these exact keys and types):
{
  "candidateSummary": "string",
  "requirementMatches": [
    {
      "requirement": "string",
      "requirementType": "required or nice_to_have",
      "judgement": "supported",
      "confidence": "medium",
      "evidence": [{ "source": "cv", "quoteOrSummary": "string", "strength": "moderate" }],
      "gaps": [],
      "suggestedScore": 3,
      "reasoning": "string"
    }
  ],
  "overall": {
    "strengths": [],
    "gaps": [],
    "concerns": [],
    "suggestedInterviewQuestions": [],
    "recruiterSummary": "string",
    "confidence": "medium",
    "confidenceRationale": "string"
  }
}`;

  const user = `Job:\n${JSON.stringify(jobPayload, null, 2)}\n\nApplication:\n${JSON.stringify(applicationPayload, null, 2)}\n\nReturn only the JSON object described in the system prompt.`;

  return {
    system,
    user,
    promptVersion: VALIDATION_PROMPT_VERSION,
    responseSchemaVersion: VALIDATION_RESPONSE_SCHEMA_VERSION,
  };
}
