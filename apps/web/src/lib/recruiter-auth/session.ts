import type { RecordModel } from "pocketbase";
import PocketBase from "pocketbase";
import type { APIContext } from "astro";

import { clearRecruiterAuthCookie } from "./cookies";
import { RECRUITER_AUTH_COOKIE } from "./constants";
import { createRecruiterPocketBase, loadAndRefreshRecruiterAuth } from "./pocketbase";

export type RecruiterRecord = RecordModel & {
  id: string;
  email: string;
  role: "admin" | "recruiter";
  active?: boolean;
};

export type RecruiterSession = {
  pb: PocketBase;
  user: RecruiterRecord;
};

export function getPortalUser(pb: PocketBase): RecruiterRecord | null {
  const model = pb.authStore.record as RecruiterRecord | null;
  if (!model) {
    return null;
  }
  // Cookie rehydration may omit `collectionName`; only reject other known auth targets.
  if (model.collectionName != null && model.collectionName !== "users") {
    return null;
  }
  if (model.active === false) {
    return null;
  }
  const role = model.role as string | undefined;
  if (role !== "admin" && role !== "recruiter") {
    return null;
  }
  return model;
}

export async function getRecruiterPocketBase(context: Pick<APIContext, "request" | "cookies">): Promise<{
  pb: PocketBase;
  user: RecruiterRecord;
} | null> {
  const hadAuthCookie = Boolean(context.cookies.get(RECRUITER_AUTH_COOKIE)?.value);
  const pb = createRecruiterPocketBase();
  const ok = await loadAndRefreshRecruiterAuth(pb, context.request.headers.get("cookie") ?? "", context.cookies);
  if (!ok) {
    if (hadAuthCookie) {
      console.warn(
        "[recruiter] session rejected: loadAndRefreshRecruiterAuth returned false (unreadable cookie, expired JWT, or auth-refresh failed).",
      );
    }
    return null;
  }
  const user = getPortalUser(pb);
  if (!user) {
    const r = pb.authStore.record as Record<string, unknown> | null;
    console.warn("[recruiter] session rejected: portal profile check failed.", {
      collectionName: r?.collectionName,
      active: r?.active,
      role: r?.role,
    });
    pb.authStore.clear();
    clearRecruiterAuthCookie(context.cookies);
    return null;
  }
  return { pb, user };
}
