import type { APIContext } from "astro";

import { RECRUITER_CSRF_COOKIE, RECRUITER_LOGIN_CSRF_COOKIE } from "./constants";

export function verifyLoginCsrf(context: Pick<APIContext, "cookies">, body: FormData): boolean {
  const expected = context.cookies.get(RECRUITER_LOGIN_CSRF_COOKIE)?.value;
  const got = String(body.get("csrf") ?? "");
  return Boolean(expected && got && expected === got);
}

export function verifySessionCsrf(context: Pick<APIContext, "cookies">, body: FormData): boolean {
  const expected = context.cookies.get(RECRUITER_CSRF_COOKIE)?.value;
  const got = String(body.get("csrf") ?? "");
  return Boolean(expected && got && expected === got);
}
