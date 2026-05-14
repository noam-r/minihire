import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import { isJobStatus } from "../../../lib/job-statuses";
import { verifySessionCsrf } from "../../../lib/recruiter-auth/csrf";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { request, redirect, locals } = context;

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return redirect("/recruiter/jobs?error=form", 303);
  }

  if (!verifySessionCsrf(context, body)) {
    return redirect("/recruiter/login?error=csrf", 303);
  }

  const session = locals.recruiter;
  if (!session) {
    return redirect("/recruiter/login", 303);
  }

  if (session.user.role !== "admin") {
    const jobId = String(body.get("job_id") ?? "").trim();
    if (jobId) {
      return redirect(`/recruiter/jobs/${jobId}?error=forbidden`, 303);
    }
    return redirect("/recruiter/jobs?error=forbidden", 303);
  }

  const jobId = String(body.get("job_id") ?? "").trim();
  if (!jobId) {
    return redirect("/recruiter/jobs?error=invalid", 303);
  }

  const { pb } = session;

  let existing;
  try {
    existing = await pb.collection("jobs").getOne(jobId);
  } catch {
    return redirect("/recruiter/jobs?error=invalid", 303);
  }

  const pick = (field: string, fallback: string): string => {
    if (!body.has(field)) {
      return fallback;
    }
    return String(body.get(field) ?? "").trim();
  };

  const title = pick("title", String(existing.title ?? "").trim());
  const slug = pick("slug", String(existing.slug ?? "").trim());
  const summary = pick("summary", String(existing.summary ?? "").trim());
  const description = pick("description", String(existing.description ?? "").trim());
  const statusRaw = body.has("status") ? String(body.get("status") ?? "").trim() : String(existing.status ?? "").trim();

  if (!title || title.length > 200) {
    return redirect(`/recruiter/jobs/${jobId}?error=fields`, 303);
  }
  if (!slug || !SLUG_PATTERN.test(slug) || slug.length > 120) {
    return redirect(`/recruiter/jobs/${jobId}?error=slug`, 303);
  }
  if (!summary || summary.length > 1000) {
    return redirect(`/recruiter/jobs/${jobId}?error=fields`, 303);
  }
  if (!description || description.length < 1) {
    return redirect(`/recruiter/jobs/${jobId}?error=fields`, 303);
  }
  if (!isJobStatus(statusRaw)) {
    return redirect(`/recruiter/jobs/${jobId}?error=status`, 303);
  }

  const payload: Record<string, unknown> = {
    title,
    slug,
    summary,
    description,
    status: statusRaw,
  };

  if (body.has("published_at")) {
    const publishedAtRaw = String(body.get("published_at") ?? "").trim();
    if (publishedAtRaw) {
      const d = new Date(publishedAtRaw);
      if (Number.isNaN(d.getTime())) {
        return redirect(`/recruiter/jobs/${jobId}?error=date`, 303);
      }
      payload.publishedAt = d.toISOString();
    }
  }

  try {
    await pb.collection("jobs").update(jobId, payload);
  } catch (error) {
    if (error instanceof ClientResponseError) {
      console.error("Job update:", error.response);
    } else {
      console.error("Job update:", error);
    }
    return redirect(`/recruiter/jobs/${jobId}?error=update`, 303);
  }

  return redirect(`/recruiter/jobs/${jobId}?updated=1`, 303);
};
