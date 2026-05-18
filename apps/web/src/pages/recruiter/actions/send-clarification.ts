import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import {
  ClarificationConflictError,
  ClarificationNotFoundError,
  createAndSendClarificationRequest,
} from "../../../lib/clarification/service";
import { ClarificationValidationError, parseClarificationQuestionsFromFormData } from "../../../lib/clarification/validation";
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

  let questions;
  try {
    questions = parseClarificationQuestionsFromFormData(body);
  } catch {
    return redirect(`/recruiter/applications/${applicationId}/clarify?error=invalid`, 303);
  }

  try {
    await createAndSendClarificationRequest(pb, {
      applicationId,
      actorUserId: user.id,
      questions,
    });
  } catch (error) {
    if (error instanceof ClarificationValidationError) {
      return redirect(`/recruiter/applications/${applicationId}/clarify?error=invalid`, 303);
    }
    if (error instanceof ClarificationConflictError) {
      return redirect(`/recruiter/applications/${applicationId}?error=clarification_active`, 303);
    }
    if (error instanceof ClarificationNotFoundError) {
      return redirect("/recruiter/applications?error=notfound", 303);
    }
    if (error instanceof ClientResponseError) {
      console.error("Send clarification:", error.response);
    } else {
      console.error("Send clarification:", error);
    }
    return redirect(`/recruiter/applications/${applicationId}?error=clarification_email`, 303);
  }

  return redirect(`/recruiter/applications/${applicationId}?clarification_sent=1`, 303);
};
