import type PocketBase from "pocketbase";

import { assessApplicationLogistics } from "./ai/validation/assess-application-logistics";
import { APPLICATION_STATUSES, isApplicationStatus } from "./application-statuses";
import { splitLinesToList } from "./sanitize";

export const APPLICATIONS_LIST_SORT_FIELDS = [
  "submitted",
  "updated",
  "cv_fit",
  "required",
  "nice_to_have",
] as const;

export type ApplicationsListSortField = (typeof APPLICATIONS_LIST_SORT_FIELDS)[number];

export type ApplicationsListSortDirection = "asc" | "desc";

export type ApplicationsListParams = {
  page: number;
  sort: ApplicationsListSortField;
  dir: ApplicationsListSortDirection;
  q: string;
  job: string;
  status: string;
};

const SORT_TO_PB_FIELD: Record<ApplicationsListSortField, string> = {
  submitted: "submitted_at",
  updated: "status_changed_at",
  cv_fit: "cv_fit_score",
  required: "required_skills_score",
  nice_to_have: "nice_to_have_score",
};

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function parseApplicationsListParams(searchParams: URLSearchParams): ApplicationsListParams {
  const pageRaw = searchParams.get("page");
  const page = Math.max(1, Number.parseInt(pageRaw || "1", 10) || 1);

  const sortRaw = searchParams.get("sort") ?? "submitted";
  const sort = APPLICATIONS_LIST_SORT_FIELDS.includes(sortRaw as ApplicationsListSortField)
    ? (sortRaw as ApplicationsListSortField)
    : "submitted";

  const dirRaw = searchParams.get("dir") ?? "desc";
  const dir: ApplicationsListSortDirection = dirRaw === "asc" ? "asc" : "desc";

  return {
    page,
    sort,
    dir,
    q: String(searchParams.get("q") ?? "").trim(),
    job: String(searchParams.get("job") ?? "").trim(),
    status: String(searchParams.get("status") ?? "").trim(),
  };
}

export function buildApplicationsListFilter(
  pb: PocketBase,
  params: Pick<ApplicationsListParams, "q" | "job" | "status">,
): string | undefined {
  const clauses: string[] = [];

  if (params.q) {
    const q = escapeFilterValue(params.q);
    clauses.push(`(full_name ~ "${q}" || email ~ "${q}")`);
  }

  if (params.job) {
    clauses.push(pb.filter("job = {:jobId}", { jobId: params.job }));
  }

  if (params.status && isApplicationStatus(params.status)) {
    clauses.push(pb.filter('status = {:status}', { status: params.status }));
  }

  if (!clauses.length) {
    return undefined;
  }

  return clauses.join(" && ");
}

export function buildApplicationsListSort(params: Pick<ApplicationsListParams, "sort" | "dir">): string {
  const field = SORT_TO_PB_FIELD[params.sort];
  return params.dir === "asc" ? field : `-${field}`;
}

export function applicationsListQueryString(
  params: ApplicationsListParams,
  overrides: Partial<ApplicationsListParams> & { error?: string } = {},
): string {
  const merged: ApplicationsListParams = { ...params, ...overrides };
  const qs = new URLSearchParams();

  if (merged.page > 1) {
    qs.set("page", String(merged.page));
  }
  if (merged.sort !== "submitted") {
    qs.set("sort", merged.sort);
  }
  if (merged.dir !== "desc") {
    qs.set("dir", merged.dir);
  }
  if (merged.q) {
    qs.set("q", merged.q);
  }
  if (merged.job) {
    qs.set("job", merged.job);
  }
  if (merged.status) {
    qs.set("status", merged.status);
  }
  if (overrides.error) {
    qs.set("error", overrides.error);
  }

  const serialized = qs.toString();
  return serialized ? `?${serialized}` : "";
}

export function formatApplicationStatusLabel(status: string): string {
  if (!isApplicationStatus(status)) {
    return status.replaceAll("_", " ");
  }
  return status.replaceAll("_", " ");
}

function applicationHasDenormalizedAiScores(row: {
  cv_fit_score?: number | null;
  required_skills_score?: number | null;
  nice_to_have_score?: number | null;
}): boolean {
  const scores = [row.cv_fit_score, row.required_skills_score, row.nice_to_have_score].filter(
    (value): value is number => value != null && !Number.isNaN(value),
  );
  if (scores.length === 0) {
    return false;
  }
  return scores.some((value) => value > 0);
}

export type ApplicationListJobExpand = {
  id?: string;
  title?: string;
  description?: string;
  workModel?: string;
  workLocation?: string;
  requiredSkills?: string;
  niceToHaveSkills?: string;
};

/** True when logistics assessment has deal-breaker or warning findings (requires expanded job). */
export function applicationHasAiLogisticsWarnings(row: {
  ai_evaluated_at?: string | null;
  cv_fit_score?: number | null;
  required_skills_score?: number | null;
  nice_to_have_score?: number | null;
  location?: string;
  timezone?: string;
  phone_number?: string;
  expand?: { job?: ApplicationListJobExpand };
}): boolean {
  if (!applicationHasAiScores(row)) {
    return false;
  }

  const jobRecord = row.expand?.job;
  if (!jobRecord?.id) {
    return false;
  }

  const findings = assessApplicationLogistics(
    {
      jobId: jobRecord.id,
      title: jobRecord.title ?? "",
      descriptionMarkdown: jobRecord.description ?? "",
      requiredSkills: splitLinesToList(jobRecord.requiredSkills),
      niceToHaveSkills: splitLinesToList(jobRecord.niceToHaveSkills),
      workModel: jobRecord.workModel,
      workLocation: jobRecord.workLocation,
    },
    {
      location: row.location,
      timezone: row.timezone,
      phoneNumber: row.phone_number,
    },
  );

  return findings.some((f) => f.severity === "deal_breaker" || f.severity === "warning");
}

/** True when AI scores are on the application (timestamp and/or denormalized fields). */
export function applicationHasAiScores(row: {
  ai_evaluated_at?: string | null;
  cv_fit_score?: number | null;
  required_skills_score?: number | null;
  nice_to_have_score?: number | null;
}): boolean {
  if (row.ai_evaluated_at != null && row.ai_evaluated_at !== "") {
    return true;
  }
  return applicationHasDenormalizedAiScores(row);
}

/** For table header sort links: toggle direction when clicking the active column. */
export function sortLinkParams(
  current: ApplicationsListParams,
  column: ApplicationsListSortField,
): ApplicationsListParams {
  if (current.sort === column) {
    return { ...current, page: 1, dir: current.dir === "desc" ? "asc" : "desc" };
  }
  return { ...current, page: 1, sort: column, dir: "desc" };
}

export { APPLICATION_STATUSES };
