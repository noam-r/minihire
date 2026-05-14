import { randomUUID } from "node:crypto";

import type { AstroCookies } from "astro";

import {
  RECRUITER_AUTH_COOKIE,
  RECRUITER_COOKIE_PATH,
  RECRUITER_CSRF_COOKIE,
  RECRUITER_LOGIN_CSRF_COOKIE,
} from "./constants";

const secure = import.meta.env.PROD;

export function cookieBaseOptions() {
  return {
    path: RECRUITER_COOKIE_PATH,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
  };
}

export function setLoginCsrfCookie(cookies: AstroCookies, token: string): void {
  cookies.set(RECRUITER_LOGIN_CSRF_COOKIE, token, {
    ...cookieBaseOptions(),
    maxAge: 60 * 15,
  });
}

export function setSessionCsrfCookie(cookies: AstroCookies, token: string): void {
  cookies.set(RECRUITER_CSRF_COOKIE, token, {
    ...cookieBaseOptions(),
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Returns existing session CSRF token or creates one (same behavior as RecruiterLayout). */
export function ensureSessionCsrfCookie(cookies: AstroCookies): string {
  let token = cookies.get(RECRUITER_CSRF_COOKIE)?.value ?? "";
  if (!token) {
    token = randomUUID();
    setSessionCsrfCookie(cookies, token);
  }
  return token;
}

export function clearRecruiterSessionCookies(cookies: AstroCookies): void {
  for (const name of [RECRUITER_AUTH_COOKIE, RECRUITER_CSRF_COOKIE, RECRUITER_LOGIN_CSRF_COOKIE]) {
    cookies.delete(name, { path: RECRUITER_COOKIE_PATH });
  }
}

export function clearRecruiterAuthCookie(cookies: AstroCookies): void {
  cookies.delete(RECRUITER_AUTH_COOKIE, { path: RECRUITER_COOKIE_PATH });
}
