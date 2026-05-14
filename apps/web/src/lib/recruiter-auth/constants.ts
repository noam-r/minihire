/** PocketBase `authStore` cookie key — must not collide with other PB auth on this origin. */
export const RECRUITER_AUTH_COOKIE = "minihire_recruiter_pb";

/** CSRF for authenticated recruiter POSTs (set on login, cleared on logout). */
export const RECRUITER_CSRF_COOKIE = "minihire_recruiter_csrf";

/** CSRF for the anonymous login form only. */
export const RECRUITER_LOGIN_CSRF_COOKIE = "minihire_recruiter_login_csrf";

export const RECRUITER_COOKIE_PATH = "/recruiter";
