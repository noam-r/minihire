import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import { validateJobFields } from "../../../lib/job-validation";
import { RECRUITER_COOKIE_PATH } from "../../../lib/recruiter-auth/constants";
import { verifySessionCsrf } from "../../../lib/recruiter-auth/csrf";

const FORM_COOKIE = "minihire_job_new_form";

export const prerender = false;

/**
 * Stores submitted form values in a short-lived cookie so the form page
 * can repopulate fields after a redirect. This avoids leaking user data
 * into the URL bar and prevents potential XSS via query parameters.
 */
function setFormCookie(context: Parameters<APIRoute>[0], fields: Record<string, string>): void {
  context.cookies.set(FORM_COOKIE, JSON.stringify(fields), {
    path: RECRUITER_COOKIE_PATH,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 120, // 2 minutes — enough to survive the redirect
  });
}

export const POST: APIRoute = async (context) => {
  const { request, redirect, locals } = context;

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return redirect("/recruiter/jobs/new?error=form", 303);
  }

  if (!verifySessionCsrf(context, body)) {
    return redirect("/recruiter/login?error=csrf", 303);
  }

  const session = locals.recruiter;
  if (!session) {
    return redirect("/recruiter/login", 303);
  }

  if (session.user.role !== "admin") {
    return redirect("/recruiter/jobs?error=forbidden", 303);
  }

  const title = String(body.get("title") ?? "").trim();
  const slug = String(body.get("slug") ?? "").trim();
  const summary = String(body.get("summary") ?? "").trim();
  const description = String(body.get("description") ?? "").trim();
  const workModel = String(body.get("work_model") ?? "").trim();
  const employmentType = String(body.get("employment_type") ?? "").trim();
  const workLocation = String(body.get("work_location") ?? "").trim();
  const requiredSkills = String(body.get("required_skills") ?? "").trim();
  const niceToHaveSkills = String(body.get("nice_to_have_skills") ?? "").trim();
  const whatToExpect = String(body.get("what_to_expect") ?? "").trim();
  const hiringProcess = String(body.get("hiring_process") ?? "").trim();

  const formFields: Record<string, string> = {
    title,
    slug,
    summary,
    description,
    work_model: workModel,
    employment_type: employmentType,
    work_location: workLocation,
    required_skills: requiredSkills,
    nice_to_have_skills: niceToHaveSkills,
    what_to_expect: whatToExpect,
    hiring_process: hiringProcess,
  };

  const validationError = validateJobFields({
    title,
    slug,
    summary,
    description,
    workModel,
    employmentType,
  });

  if (validationError) {
    setFormCookie(context, formFields);
    return redirect(`/recruiter/jobs/new?error=${validationError}`, 303);
  }

  const payload = {
    title,
    slug,
    summary,
    description,
    status: "draft",
    workModel,
    employmentType,
    workLocation: workLocation || "",
    requiredSkills: requiredSkills || "",
    niceToHaveSkills: niceToHaveSkills || "",
    whatToExpect: whatToExpect || "",
    hiringProcess: hiringProcess || "",
  };

  const { pb } = session;

  try {
    const newRecord = await pb.collection("jobs").create(payload);
    return redirect(`/recruiter/jobs/${newRecord.id}?created=1`, 303);
  } catch (error) {
    let errorCode = "create";
    if (error instanceof ClientResponseError) {
      console.error("Job create:", error.response);
      // Surface specific PocketBase errors
      const data = error.response?.data as Record<string, { code?: string; message?: string }> | undefined;
      if (data?.slug?.code === "validation_not_unique") {
        errorCode = "slug_taken";
      }
    } else {
      console.error("Job create:", error);
    }

    setFormCookie(context, formFields);
    return redirect(`/recruiter/jobs/new?error=${errorCode}`, 303);
  }
};
