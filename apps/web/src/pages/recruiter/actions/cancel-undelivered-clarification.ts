import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import {
  cancelUndeliveredClarificationRequest,
  ClarificationConflictError,
  ClarificationNotFoundError,
} from "../../../lib/clarification/service";
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
  const requestId = String(body.get("request_id") ?? "").trim();
  if (!applicationId || !requestId) {
    return redirect("/recruiter/applications?error=invalid", 303);
  }

  const { pb } = session;

  try {
    await cancelUndeliveredClarificationRequest(pb, requestId);
  } catch (error) {
    if (error instanceof ClarificationNotFoundError) {
      return redirect("/recruiter/applications?error=notfound", 303);
    }
    if (error instanceof ClientResponseError) {
      console.error("Cancel undelivered clarification:", error.status, error.response);
    } else {
      console.error("Cancel undelivered clarification:", error);
    }
    return redirect(`/recruiter/applications/${applicationId}?error=clarification_email`, 303);
  }

  return redirect(`/recruiter/applications/${applicationId}?clarification_cancelled=1`, 303);
};
