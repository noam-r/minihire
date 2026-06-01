import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import {
  CandidateEmailNotFoundError,
  CandidateEmailSendError,
  sendRecruiterCandidateEmail,
} from "../../../lib/recruiter-candidate-email/send";
import { isRecruiterCandidateEmailType } from "../../../lib/recruiter-candidate-email/types";
import { CandidateEmailValidationError } from "../../../lib/recruiter-candidate-email/validation";
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
  const emailTypeRaw = String(body.get("email_type") ?? "").trim();
  const emailBody = String(body.get("body") ?? "");
  const setRejected = String(body.get("set_rejected") ?? "") === "1";

  if (!applicationId || !isRecruiterCandidateEmailType(emailTypeRaw)) {
    return redirect("/recruiter/applications?error=invalid", 303);
  }

  const { pb, user } = session;

  try {
    const result = await sendRecruiterCandidateEmail(pb, {
      applicationId,
      actorUserId: user.id,
      type: emailTypeRaw,
      body: emailBody,
      setRejected: emailTypeRaw === "rejection" && setRejected,
    });

    const params = new URLSearchParams({ email_sent: "1" });
    if (result.statusUpdated) {
      params.set("status_updated", "1");
    }
    return redirect(`/recruiter/applications/${applicationId}?${params.toString()}`, 303);
  } catch (error) {
    if (error instanceof CandidateEmailValidationError) {
      return redirect(`/recruiter/applications/${applicationId}/email?error=invalid&type=${emailTypeRaw}`, 303);
    }
    if (error instanceof CandidateEmailNotFoundError) {
      return redirect("/recruiter/applications?error=notfound", 303);
    }
    if (error instanceof CandidateEmailSendError) {
      return redirect(`/recruiter/applications/${applicationId}?error=email_send`, 303);
    }
    if (error instanceof ClientResponseError) {
      console.error("Send candidate email PocketBase error:", error.status, error.response);
    } else if (error instanceof Error) {
      console.error("Send candidate email failed:", error.message);
    } else {
      console.error("Send candidate email failed:", error);
    }
    return redirect(`/recruiter/applications/${applicationId}?error=email_send`, 303);
  }
};
