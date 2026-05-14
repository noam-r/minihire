/// <reference path="../pb_data/types.d.ts" />

/**
 * After `1747066300`, existing `users` rows can have `active = false` (SQLite default) while
 * `role` was set — that blocks portal login (`getPortalUser` treats `active === false` as disabled).
 * Turn `active` on for users that already have a portal `role`.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const records = app.findRecordsByFilter(
      users.id,
      '(role = "admin" || role = "recruiter") && active = false',
      "",
      500,
      0,
    );
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      r.set("active", true);
      app.save(r);
    }
  },
  (app) => {
    void app;
  },
);
