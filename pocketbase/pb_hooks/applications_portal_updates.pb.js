/// <reference path="../pb_data/types.d.ts" />

const PORTAL_APPLICATION_UPDATE_FIELDS = new Set(["status", "starred"]);

/**
 * Portal recruiters (PocketBase `users` auth) may only PATCH allowlisted fields on `applications`.
 * Superusers bypass this check. `submission_service` does not hit update (rules deny).
 */
onRecordUpdateRequest((e) => {
  if (!e.collection || e.collection.name !== "applications") {
    e.next();
    return;
  }
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const auth = e.auth;
  if (!auth || auth.collection().name !== "users") {
    e.next();
    return;
  }

  const body = e.requestInfo().body || {};
  for (const key of Object.keys(body)) {
    if (!PORTAL_APPLICATION_UPDATE_FIELDS.has(key)) {
      throw new BadRequestError(
        "portal users may only update status and starred on applications",
      );
    }
  }

  e.next();
});
