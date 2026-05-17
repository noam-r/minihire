/// <reference path="../pb_data/types.d.ts" />

/**
 * Portal recruiters (PocketBase `users` auth) may only PATCH `applications.status`.
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
    if (key !== "status") {
      throw new BadRequestError("portal users may only update the status field on applications");
    }
  }

  e.next();
});
