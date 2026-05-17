import type { APIRoute } from "astro";

import { getSubmissionServicePocketBase } from "../../../lib/pocketbase";
import { hasActiveAiRun, loadRecruiterAiSnapshot } from "../../../lib/recruiter-ai/load-snapshot";
import { verifySessionCsrf } from "../../../lib/recruiter-auth/csrf";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { request, redirect, locals } = context;

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return redirect("/recruiter/applications?error=form", 303);
  }

  if (!verifySessionCsrf(context, body)) {
    return redirect("/recruiter/login?error=csrf", 303);
  }

  if (!locals.recruiter) {
    return redirect("/recruiter/login", 303);
  }

  const applicationId = String(body.get("application_id") ?? "").trim();
  if (!applicationId) {
    return redirect("/recruiter/applications?error=invalid", 303);
  }

  const { pb } = locals.recruiter;

  try {
    await pb.collection("applications").getOne(applicationId);
  } catch {
    return redirect("/recruiter/applications?error=notfound", 303);
  }

  try {
    const snapshot = await loadRecruiterAiSnapshot(pb, applicationId);
    const run = snapshot.activeRun;
    if (!run || !hasActiveAiRun(snapshot)) {
      return redirect(`/recruiter/applications/${applicationId}`, 303);
    }

    const workerPb = await getSubmissionServicePocketBase();
    await workerPb.collection("application_ai_runs").update(run.id, {
      status: "failed",
      error_message: "Cancelled from recruiter portal",
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cancel-ai-evaluation]", error);
    return redirect(`/recruiter/applications/${applicationId}?error=ai_run`, 303);
  }

  return redirect(`/recruiter/applications/${applicationId}?ai_cancelled=1`, 303);
};
