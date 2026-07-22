const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const WORK_MODELS = ["remote", "hybrid", "onsite"] as const;
const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;

export interface JobFieldsInput {
  title: string;
  slug: string;
  summary: string;
  description: string;
  workModel: string;
  employmentType: string;
}

export type ValidationError = "fields" | "slug" | "work_model" | "employment_type";

/** Returns null if valid, or an error code if invalid. */
export function validateJobFields(input: JobFieldsInput): ValidationError | null {
  if (!input.title || input.title.length > 200) {
    return "fields";
  }

  if (!input.slug || !SLUG_PATTERN.test(input.slug) || input.slug.length > 120) {
    return "slug";
  }

  if (!input.summary || input.summary.length > 1000) {
    return "fields";
  }

  if (!input.description || input.description.length < 1) {
    return "fields";
  }

  if (!WORK_MODELS.includes(input.workModel as (typeof WORK_MODELS)[number])) {
    return "work_model";
  }

  if (!EMPLOYMENT_TYPES.includes(input.employmentType as (typeof EMPLOYMENT_TYPES)[number])) {
    return "employment_type";
  }

  return null;
}
