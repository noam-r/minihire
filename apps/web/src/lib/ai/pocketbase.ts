import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import { ClientResponseError } from "pocketbase";

import { splitLinesToList } from "../sanitize";
import type { NormalizedJob } from "./shared/types";

export type ApplicationRecord = RecordModel & {
  job: string;
  full_name: string;
  email: string;
  location?: string;
  timezone?: string;
  phone_number?: string;
  github_url?: string;
  portfolio_url?: string;
  linkedin_url?: string;
  anything_else?: string;
  cv_file: string;
  consent_to_store_data: boolean;
};

export type JobRecord = RecordModel & {
  title: string;
  description: string;
  workModel?: string;
  workLocation?: string;
  employmentType?: string;
  requiredSkills?: string;
  niceToHaveSkills?: string;
  hiringProcess?: string;
};

export type AiRunRecord = RecordModel & {
  application: string;
  run_type: string;
  status: string;
  started_by: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
};

export function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export async function loadApplication(
  pb: PocketBase,
  applicationId: string,
): Promise<ApplicationRecord> {
  return pb.collection("applications").getOne<ApplicationRecord>(applicationId);
}

export async function loadJob(pb: PocketBase, jobId: string): Promise<JobRecord> {
  try {
    return await pb.collection("jobs").getOne<JobRecord>(jobId);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new Error(
        `Job ${jobId} could not be loaded (missing or not readable by submission_service). ` +
          "Ensure migration 1747067600_jobs_submission_service_read is applied and PocketBase was restarted.",
      );
    }
    throw error;
  }
}

export function mapNormalizedJob(record: JobRecord): NormalizedJob {
  return {
    jobId: record.id,
    title: record.title,
    descriptionMarkdown: record.description,
    requiredSkills: splitLinesToList(record.requiredSkills),
    niceToHaveSkills: splitLinesToList(record.niceToHaveSkills),
    workModel: record.workModel,
    workLocation: record.workLocation,
    employmentType: record.employmentType,
    hiringProcess: record.hiringProcess,
  };
}

export async function downloadCvBytes(
  pb: PocketBase,
  application: ApplicationRecord,
): Promise<{ fileName: string; bytes: Uint8Array; mimeType: string }> {
  const fileName = String(application.cv_file);
  const fileUrl = pb.files.getURL(application, fileName);
  const response = await fetch(fileUrl, {
    headers: {
      Authorization: `Bearer ${pb.authStore.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download CV (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") || guessMimeFromFileName(fileName);

  return { fileName, bytes: new Uint8Array(buffer), mimeType };
}

function guessMimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "text/markdown";
  }
  if (lower.endsWith(".txt")) {
    return "text/plain";
  }
  return "application/octet-stream";
}

export async function findRequestedAiRuns(pb: PocketBase, limit = 5): Promise<AiRunRecord[]> {
  // PocketBase list API rejects sort on system fields like `created` (400); sort in memory.
  const rows = await pb.collection("application_ai_runs").getFullList<AiRunRecord>({
    filter: 'status = "requested"',
  });
  return rows
    .sort((a, b) => {
      const ta = Date.parse(String(a.created ?? ""));
      const tb = Date.parse(String(b.created ?? ""));
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
        return ta - tb;
      }
      return a.id.localeCompare(b.id);
    })
    .slice(0, limit);
}
