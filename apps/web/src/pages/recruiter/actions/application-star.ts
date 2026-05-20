import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

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
  const starredRaw = String(body.get("starred") ?? "").trim();
  if (!applicationId || (starredRaw !== "1" && starredRaw !== "0")) {
    return redirect("/recruiter/applications?error=invalid", 303);
  }

  const nextStarred = starredRaw === "1";
  const { pb } = session;

  try {
    await pb.collection("applications").getOne(applicationId);
  } catch {
    return redirect("/recruiter/applications?error=notfound", 303);
  }

  try {
    await pb.collection("applications").update(applicationId, { starred: nextStarred });
  } catch (error) {
    if (error instanceof ClientResponseError) {
      console.error("Application star update:", error.response);
    } else {
      console.error("Application star update:", error);
    }
    return redirect(`/recruiter/applications/${applicationId}?error=star`, 303);
  }

  return redirect(`/recruiter/applications/${applicationId}?starred_updated=1`, 303);
};
