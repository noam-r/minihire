import type { RecordModel } from "pocketbase";

import { getPublicPocketBase } from "./pocketbase";
import { splitLinesToList } from "./sanitize";

type JobRecord = RecordModel & {
  slug: string;
  title: string;
  summary: string;
  description: string;
  whatToExpect?: string;
  workModel: "remote" | "hybrid" | "onsite";
  workLocation?: string;
  employmentType: "full_time" | "part_time" | "contract" | "internship";
  status: "draft" | "published" | "archived";
  requiredSkills?: string;
  niceToHaveSkills?: string;
  hiringProcess?: string;
  publishedAt?: string;
};

export interface Job {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  whatToExpect: string;
  workModel: JobRecord["workModel"];
  workLocation: string;
  employmentType: JobRecord["employmentType"];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  hiringProcess: string;
  publishedAt: string;
}

function mapJob(record: JobRecord): Job {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    description: record.description,
    whatToExpect: record.whatToExpect ?? "",
    workModel: record.workModel,
    workLocation: record.workLocation ?? "",
    employmentType: record.employmentType,
    requiredSkills: splitLinesToList(record.requiredSkills),
    niceToHaveSkills: splitLinesToList(record.niceToHaveSkills),
    hiringProcess: record.hiringProcess ?? "",
    publishedAt: record.publishedAt ?? "",
  };
}

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export async function getPublishedJobs(): Promise<Job[]> {
  const pb = getPublicPocketBase();
  const records = await pb.collection("jobs").getFullList<JobRecord>({
    filter: 'status = "published"',
    sort: "-publishedAt",
  });

  return records.map(mapJob);
}

export async function getPublishedJobBySlug(slug: string): Promise<Job | null> {
  const pb = getPublicPocketBase();

  try {
    const record = await pb.collection("jobs").getFirstListItem<JobRecord>(
      `slug = "${escapeFilterValue(slug)}" && status = "published"`,
    );

    return mapJob(record);
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export function formatEmploymentType(value: Job["employmentType"]): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatWorkModel(value: Job["workModel"]): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
