import PocketBase, { cookieSerialize, getTokenPayload, isTokenExpired } from "pocketbase";
import type { AstroCookies } from "astro";

import { requireRuntimeEnv } from "../server-env";
import { RECRUITER_AUTH_COOKIE } from "./constants";
import { clearRecruiterAuthCookie, cookieBaseOptions } from "./cookies";

/** True if the raw `Cookie` header includes our recruiter auth pair (even if malformed). */
function cookieHeaderHasRecruiterAuth(cookieHeader: string): boolean {
  const prefix = `${RECRUITER_AUTH_COOKIE}=`;
  for (const part of (cookieHeader || "").split(";")) {
    if (part.trim().startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

export function createRecruiterPocketBase(): PocketBase {
  return new PocketBase(requireRuntimeEnv("POCKETBASE_URL"));
}

/**
 * PocketBase `exportToCookie` drops `role` / `active` when the payload exceeds 4KB (it keeps only
 * id, email, collectionId, collectionName, verified). The recruiter portal requires `role` and
 * `active` on every request — build a compact cookie that always includes them.
 */
function serializeRecruiterAuthCookie(pb: PocketBase): string {
  const record = pb.authStore.record as Record<string, unknown> | null;
  if (!record) {
    throw new Error("serializeRecruiterAuthCookie: missing auth record");
  }
  const snapshot = {
    id: record.id,
    email: record.email,
    collectionId: record.collectionId,
    // Rehydrated cookies often omit this; portal auth must still recognize PocketBase `users`.
    collectionName: (record.collectionName as string | undefined) || "users",
    verified: record.verified,
    role: record.role,
    active: record.active,
  };
  const payload = JSON.stringify({ token: pb.authStore.token, record: snapshot });
  const p = getTokenPayload(pb.authStore.token);
  const base = cookieBaseOptions();
  return cookieSerialize(RECRUITER_AUTH_COOKIE, payload, {
    httpOnly: base.httpOnly,
    secure: base.secure,
    sameSite: "lax",
    path: base.path,
    ...(p.exp ? { expires: new Date(p.exp * 1000) } : {}),
    maxAge: p.exp ? Math.max(0, Math.floor(p.exp - Date.now() / 1000)) : undefined,
  });
}

/**
 * Value from PocketBase `cookieSerialize` is already `encodeURIComponent`'d. Astro's `cookies.set`
 * uses the `cookie` package, which encodes again — that double-encoding breaks `authStore.loadFromCookie`
 * (`JSON.parse` sees `%7B...` instead of `{...}`). Decode once before handing off to Astro.
 */
function decodePbCookieSerializeValue(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

/**
 * PocketBase `exportToCookie` returns a full `Set-Cookie` value; Astro's `cookies.set` cannot
 * parse it, so we split name/value/options heuristically for the auth payload cookie only.
 */
function appendSetCookieFromPb(cookies: AstroCookies, setCookieValue: string): void {
  const firstPart = setCookieValue.split(";")[0]?.trim() ?? "";
  const eq = firstPart.indexOf("=");
  if (eq === -1) {
    return;
  }
  const name = firstPart.slice(0, eq);
  const value = decodePbCookieSerializeValue(firstPart.slice(eq + 1));
  if (!name) {
    return;
  }

  let maxAge: number | undefined;
  for (const part of setCookieValue.split(";").slice(1)) {
    const p = part.trim().toLowerCase();
    if (p.startsWith("max-age=")) {
      const n = Number(p.slice("max-age=".length).trim());
      if (Number.isFinite(n)) {
        maxAge = n;
      }
    }
  }

  cookies.set(name, value, {
    ...cookieBaseOptions(),
    ...(maxAge !== undefined ? { maxAge } : {}),
  });
}

/**
 * Loads recruiter auth from the HTTP-only PB cookie, then refreshes the token when valid.
 * On success, re-serializes auth into the response cookies via `cookies`.
 * Returns false if unauthenticated or refresh failed (store cleared).
 */
export async function loadAndRefreshRecruiterAuth(
  pb: PocketBase,
  cookieHeader: string,
  cookies: AstroCookies,
): Promise<boolean> {
  pb.authStore.loadFromCookie(cookieHeader || "", RECRUITER_AUTH_COOKIE);

  if (!pb.authStore.isValid) {
    // Drop unusable auth cookies on the wire so users are not stuck with a zombie value
    // (corrupt encoding, expired JWT, revoked token, etc.) until they clear site data manually.
    if (cookieHeaderHasRecruiterAuth(cookieHeader)) {
      clearRecruiterAuthCookie(cookies);
    }
    return false;
  }

  /**
   * Only hit PocketBase `auth-refresh` when the access token is near expiry.
   * Refreshing on every request fails for some PB/SDK combos right after login (rotation / timing),
   * which produced a redirect loop with a misleading "session" error.
   */
  const refreshIfExpiresWithinSec = 300;
  if (isTokenExpired(pb.authStore.token, refreshIfExpiresWithinSec)) {
    try {
      await pb.collection("users").authRefresh();
    } catch (err) {
      console.warn("[recruiter] PocketBase authRefresh failed:", err);
      pb.authStore.clear();
      clearRecruiterAuthCookie(cookies);
      return false;
    }
  }

  appendSetCookieFromPb(cookies, serializeRecruiterAuthCookie(pb));
  return true;
}

export function saveRecruiterAuthFromLogin(pb: PocketBase, cookies: AstroCookies): void {
  appendSetCookieFromPb(cookies, serializeRecruiterAuthCookie(pb));
}
