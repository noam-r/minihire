import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import { syncApplicationStatusChangedAt } from "../../../lib/ai/pipeline/store-artifacts";
import { isApplicationStatus } from "../../../lib/application-statuses";
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
  const nextStatus = String(body.get("status") ?? "").trim();
  if (!applicationId || !isApplicationStatus(nextStatus)) {
    return redirect("/recruiter/applications?error=invalid", 303);
  }

  const { pb, user } = session;

  let current;
  try {
    current = await pb.collection("applications").getOne(applicationId);
  } catch {
    return redirect("/recruiter/applications?error=notfound", 303);
  }

  const prev = String(current.status ?? "");
  if (prev === nextStatus) {
    return redirect(`/recruiter/applications/${applicationId}`, 303);
  }

  try {
    await pb.collection("applications").update(applicationId, { status: nextStatus });
  } catch (error) {
    if (error instanceof ClientResponseError) {
      console.error("Application status update:", error.response);
    } else {
      console.error("Application status update:", error);
    }
    return redirect(`/recruiter/applications/${applicationId}?error=status`, 303);
  }

  try {
    await pb.collection("application_status_history").create({
      application: applicationId,
      from_status: prev || null,
      to_status: nextStatus,
      changed_by: user.id,
    });
  } catch (error) {
    console.error("application_status_history create:", error);
  }

  try {
    await syncApplicationStatusChangedAt(pb, applicationId);
  } catch (error) {
    console.error("application status_changed_at sync:", error);
  }

  return redirect(`/recruiter/applications/${applicationId}?updated=1`, 303);
};
