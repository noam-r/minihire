import type { APIRoute } from "astro";

import { createEvaluationRun } from "../../../lib/ai/pipeline/process-evaluation-run";
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

  const session = locals.recruiter;
  if (!session) {
    return redirect("/recruiter/login", 303);
  }

  const applicationId = String(body.get("application_id") ?? "").trim();
  if (!applicationId) {
    return redirect("/recruiter/applications?error=invalid", 303);
  }

  const { pb, user } = session;

  try {
    await pb.collection("applications").getOne(applicationId);
  } catch {
    return redirect("/recruiter/applications?error=notfound", 303);
  }

  try {
    const snapshot = await loadRecruiterAiSnapshot(pb, applicationId);
    if (hasActiveAiRun(snapshot)) {
      return redirect(`/recruiter/applications/${applicationId}?error=ai_run`, 303);
    }

    await createEvaluationRun(pb, {
      applicationId,
      startedByUserId: user.id,
      runType: "cv_validation",
    });
  } catch (error) {
    console.error("[run-ai-evaluation]", error);
    return redirect(`/recruiter/applications/${applicationId}?error=ai_run`, 303);
  }

  return redirect(`/recruiter/applications/${applicationId}?ai_requested=1`, 303);
};
