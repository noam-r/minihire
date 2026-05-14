import type { APIRoute } from "astro";
import { ClientResponseError } from "pocketbase";

import { clearRecruiterSessionCookies, setSessionCsrfCookie } from "../../../lib/recruiter-auth/cookies";
import { RECRUITER_COOKIE_PATH, RECRUITER_LOGIN_CSRF_COOKIE } from "../../../lib/recruiter-auth/constants";
import { verifyLoginCsrf } from "../../../lib/recruiter-auth/csrf";
import { recruiterLoginErrorUrl, recruiterPostLoginSuccessUrl } from "../../../lib/recruiter-auth/login-redirect";
import { createRecruiterPocketBase, saveRecruiterAuthFromLogin } from "../../../lib/recruiter-auth/pocketbase";
import { getPortalUser } from "../../../lib/recruiter-auth/session";
import { randomUUID } from "node:crypto";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { request, cookies, redirect } = context;

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return redirect("/recruiter/login?error=csrf", 303);
  }

  const nextFromForm = String(body.get("next") ?? "");

  if (!verifyLoginCsrf(context, body)) {
    return redirect(recruiterLoginErrorUrl("csrf", nextFromForm), 303);
  }

  const email = String(body.get("email") ?? "").trim();
  const password = String(body.get("password") ?? "");

  if (!email || !password) {
    return redirect(recruiterLoginErrorUrl("invalid", nextFromForm), 303);
  }

  const pb = createRecruiterPocketBase();

  try {
    await pb.collection("users").authWithPassword(email, password);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 400) {
      return redirect(recruiterLoginErrorUrl("invalid", nextFromForm), 303);
    }
    console.error("Recruiter login error:", error);
    return redirect(recruiterLoginErrorUrl("invalid", nextFromForm), 303);
  }

  const user = getPortalUser(pb);
  if (!user) {
    pb.authStore.clear();
    clearRecruiterSessionCookies(cookies);
    return redirect(recruiterLoginErrorUrl("portal_profile", nextFromForm), 303);
  }

  saveRecruiterAuthFromLogin(pb, cookies);
  cookies.delete(RECRUITER_LOGIN_CSRF_COOKIE, { path: RECRUITER_COOKIE_PATH });
  setSessionCsrfCookie(cookies, randomUUID());

  return redirect(recruiterPostLoginSuccessUrl(nextFromForm), 303);
};
