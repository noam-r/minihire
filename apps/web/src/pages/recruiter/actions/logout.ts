import type { APIRoute } from "astro";

import { clearRecruiterSessionCookies } from "../../../lib/recruiter-auth/cookies";
import { verifySessionCsrf } from "../../../lib/recruiter-auth/csrf";
import { createRecruiterPocketBase, loadAndRefreshRecruiterAuth } from "../../../lib/recruiter-auth/pocketbase";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { request, cookies, redirect } = context;

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return redirect("/recruiter/login", 303);
  }

  if (!verifySessionCsrf(context, body)) {
    return redirect("/recruiter/login?error=csrf", 303);
  }

  const pb = createRecruiterPocketBase();
  await loadAndRefreshRecruiterAuth(pb, request.headers.get("cookie") ?? "", cookies);
  pb.authStore.clear();
  clearRecruiterSessionCookies(cookies);

  return redirect("/recruiter/login", 303);
};
