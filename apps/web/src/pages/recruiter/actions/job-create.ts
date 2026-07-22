import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import { validateJobFields } from "../../../lib/job-validation";
import { verifySessionCsrf } from "../../../lib/recruiter-auth/csrf";

export const prerender = false;

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

  const validationError = validateJobFields({
    title,
    slug,
    summary,
    description,
    workModel,
    employmentType,
  });

  if (validationError) {
    const params = new URLSearchParams();
    params.set("error", validationError);
    params.set("title", title);
    params.set("slug", slug);
    params.set("summary", summary);
    params.set("description", description);
    params.set("work_model", workModel);
    params.set("employment_type", employmentType);
    params.set("work_location", workLocation);
    params.set("required_skills", requiredSkills);
    params.set("nice_to_have_skills", niceToHaveSkills);
    params.set("what_to_expect", whatToExpect);
    params.set("hiring_process", hiringProcess);
    return redirect(`/recruiter/jobs/new?${params.toString()}`, 303);
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
    if (error instanceof ClientResponseError) {
      console.error("Job create:", error.response);
    } else {
      console.error("Job create:", error);
    }

    const params = new URLSearchParams();
    params.set("error", "create");
    params.set("title", title);
    params.set("slug", slug);
    params.set("summary", summary);
    params.set("description", description);
    params.set("work_model", workModel);
    params.set("employment_type", employmentType);
    params.set("work_location", workLocation);
    params.set("required_skills", requiredSkills);
    params.set("nice_to_have_skills", niceToHaveSkills);
    params.set("what_to_expect", whatToExpect);
    params.set("hiring_process", hiringProcess);
    return redirect(`/recruiter/jobs/new?${params.toString()}`, 303);
  }
};
