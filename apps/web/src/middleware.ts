import { defineMiddleware } from "astro:middleware";

import { RECRUITER_AUTH_COOKIE } from "./lib/recruiter-auth/constants";
import { sanitizeRecruiterNext } from "./lib/recruiter-auth/redirect-next";
import { getRecruiterPocketBase } from "./lib/recruiter-auth/session";

const PUBLIC_PREFIXES = ["/recruiter/login", "/recruiter/actions/login"];

function isPublicRecruiterPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!pathname.startsWith("/recruiter")) {
    return next();
  }

  if (isPublicRecruiterPath(pathname)) {
    return next();
  }

  const session = await getRecruiterPocketBase(context);
  if (!session) {
    const dest = pathname + context.url.search;
    if (dest.length > 2048) {
      return context.redirect("/recruiter/login?error=session");
    }
    const sanitizedDest = sanitizeRecruiterNext(dest);
    const loginQs = new URLSearchParams();
    if (context.cookies.get(RECRUITER_AUTH_COOKIE)?.value) {
      loginQs.set("error", "session");
    }
    if (sanitizedDest !== "/recruiter") {
      loginQs.set("next", dest);
    }
    const q = loginQs.toString();
    return context.redirect(q ? `/recruiter/login?${q}` : "/recruiter/login");
  }

  context.locals.recruiter = session;
  return next();
});
