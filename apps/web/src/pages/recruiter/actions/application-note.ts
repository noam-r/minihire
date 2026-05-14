import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import { verifySessionCsrf } from "../../../lib/recruiter-auth/csrf";

const MAX_NOTE_LEN = 8000;

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
  const noteBody = String(body.get("body") ?? "").trim();
  if (!applicationId) {
    return redirect("/recruiter/applications?error=invalid", 303);
  }
  if (noteBody.length < 1 || noteBody.length > MAX_NOTE_LEN) {
    return redirect(`/recruiter/applications/${applicationId}?error=note`, 303);
  }

  const { pb, user } = session;

  try {
    await pb.collection("applications").getOne(applicationId);
  } catch {
    return redirect("/recruiter/applications?error=notfound", 303);
  }

  try {
    await pb.collection("application_notes").create({
      application: applicationId,
      body: noteBody,
      author: user.id,
    });
  } catch (error) {
    if (error instanceof ClientResponseError) {
      console.error("Application note create:", error.response);
    } else {
      console.error("Application note create:", error);
    }
    return redirect(`/recruiter/applications/${applicationId}?error=note_save`, 303);
  }

  return redirect(`/recruiter/applications/${applicationId}?note=1`, 303);
};
