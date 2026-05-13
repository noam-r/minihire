import { z } from "zod";

import {
  normalizeEmail,
  normalizeLongText,
  normalizeShortText,
  trimText,
} from "./sanitize";

const MAX_FULL_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_NUMBER_LENGTH = 40;
const MAX_LOCATION_LENGTH = 120;
const MAX_TIMEZONE_LENGTH = 80;
const MAX_URL_LENGTH = 300;
const MAX_LONG_ANSWER_LENGTH = 2000;
const ALLOWED_CV_EXTENSIONS = [".pdf", ".md", ".markdown"] as const;
const emailSchema = z.email();
const urlSchema = z.url();

const applicationSchema = z.object({
  job_slug: z.string().min(1, "Select a job and try again."),
  full_name: z
    .string()
    .min(1, "Enter your full name.")
    .max(MAX_FULL_NAME_LENGTH, `Use ${MAX_FULL_NAME_LENGTH} characters or fewer.`),
  email: z
    .string()
    .min(1, "Enter your email address.")
    .max(MAX_EMAIL_LENGTH, `Use ${MAX_EMAIL_LENGTH} characters or fewer.`)
    .refine((value) => emailSchema.safeParse(value).success, "Enter a valid email address."),
  phone_number: z
    .string()
    .max(MAX_PHONE_NUMBER_LENGTH, `Use ${MAX_PHONE_NUMBER_LENGTH} characters or fewer.`),
  location: z.string().max(MAX_LOCATION_LENGTH, `Use ${MAX_LOCATION_LENGTH} characters or fewer.`),
  timezone: z.string().max(MAX_TIMEZONE_LENGTH, `Use ${MAX_TIMEZONE_LENGTH} characters or fewer.`),
  github_url: z
    .string()
    .max(MAX_URL_LENGTH, `Use ${MAX_URL_LENGTH} characters or fewer.`)
    .refine((value) => value === "" || urlSchema.safeParse(value).success, "Enter a valid URL."),
  portfolio_url: z
    .string()
    .max(MAX_URL_LENGTH, `Use ${MAX_URL_LENGTH} characters or fewer.`)
    .refine((value) => value === "" || urlSchema.safeParse(value).success, "Enter a valid URL."),
  linkedin_url: z
    .string()
    .max(MAX_URL_LENGTH, `Use ${MAX_URL_LENGTH} characters or fewer.`)
    .refine((value) => value === "" || urlSchema.safeParse(value).success, "Enter a valid URL."),
  anything_else: z
    .string()
    .max(MAX_LONG_ANSWER_LENGTH, `Use ${MAX_LONG_ANSWER_LENGTH} characters or fewer.`),
  consent_to_store_data: z
    .boolean()
    .refine((value) => value, "You must consent before submitting."),
});

export interface ValidatedApplicationInput {
  job_slug: string;
  full_name: string;
  email: string;
  phone_number: string;
  location: string;
  timezone: string;
  github_url: string;
  portfolio_url: string;
  linkedin_url: string;
  anything_else: string;
  consent_to_store_data: boolean;
  cvFile: File;
}

export interface ValidationResult {
  success: boolean;
  data?: ValidatedApplicationInput;
  fields?: Record<string, string>;
}

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex === -1) {
    return "";
  }

  return filename.slice(dotIndex).toLowerCase();
}

function buildFieldErrorMap(issues: z.ZodError["issues"]): Record<string, string> {
  return issues.reduce<Record<string, string>>((fields, issue) => {
    const key = issue.path[0];

    if (typeof key === "string" && !fields[key]) {
      fields[key] = issue.message;
    }

    return fields;
  }, {});
}

export function validateApplicationFormData(
  formData: FormData,
  maxCvSizeBytes: number,
): ValidationResult {
  const candidateInput = {
    job_slug: trimText(formData.get("job_slug")),
    full_name: normalizeShortText(formData.get("full_name")),
    email: normalizeEmail(formData.get("email")),
    phone_number: normalizeShortText(formData.get("phone_number")),
    location: normalizeShortText(formData.get("location")),
    timezone: normalizeShortText(formData.get("timezone")),
    github_url: trimText(formData.get("github_url")),
    portfolio_url: trimText(formData.get("portfolio_url")),
    linkedin_url: trimText(formData.get("linkedin_url")),
    anything_else: normalizeLongText(formData.get("anything_else")),
    consent_to_store_data: formData.get("consent_to_store_data") === "true",
  };

  const parsed = applicationSchema.safeParse(candidateInput);

  const fields = parsed.success ? {} : buildFieldErrorMap(parsed.error.issues);

  const cvFile = formData.get("cv_file");

  if (!(cvFile instanceof File) || cvFile.size === 0) {
    fields.cv_file = "Upload your CV to continue.";
  } else {
    const extension = getFileExtension(cvFile.name);

    if (!ALLOWED_CV_EXTENSIONS.includes(extension as (typeof ALLOWED_CV_EXTENSIONS)[number])) {
      fields.cv_file = "Upload a PDF or Markdown CV.";
    } else if (cvFile.size > maxCvSizeBytes) {
      fields.cv_file = "Your CV must be 5 MB or smaller.";
    }
  }

  if (Object.keys(fields).length > 0 || !parsed.success || !(cvFile instanceof File)) {
    return {
      success: false,
      fields,
    };
  }

  return {
    success: true,
    data: {
      ...parsed.data,
      cvFile,
    },
  };
}

export function getMaxCvSizeBytes(): number {
  const raw = import.meta.env.MAX_CV_SIZE_BYTES;

  if (!raw) {
    return 5 * 1024 * 1024;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 1024 * 1024;
}
