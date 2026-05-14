/// <reference path="../pb_data/types.d.ts" />

/**
 * Repair: `1747066000_recruiter_portal_users_rules` used try/catch around `getByName("role")`,
 * but in JS migrations `getByName` may not throw when the field is missing — so rules updated
 * while `role` / `active` were never added. This migration adds them using `fieldNames()` +
 * `addMarshaledJSON` (plain objects are not accepted by `addAt` in the Goja bridge).
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const names = users.fields.fieldNames() || [];
    const addedRole = !names.includes("role");
    const addedActive = !names.includes("active");
    let changed = false;

    if (addedRole) {
      users.fields.addMarshaledJSON(
        '{"type":"select","name":"role","required":false,"maxSelect":1,"values":["admin","recruiter"]}',
      );
      changed = true;
    }

    if (addedActive) {
      users.fields.addMarshaledJSON('{"type":"bool","name":"active","required":false}');
      changed = true;
    }

    if (changed) {
      app.save(users);
    }

    const records = app.findRecordsByFilter(users.id, "1 = 1", "", 500, 0);
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      let dirty = false;
      if (addedRole && (r.get("role") == null || r.get("role") === "")) {
        r.set("role", "recruiter");
        dirty = true;
      }
      if (addedActive && r.get("active") !== true) {
        r.set("active", true);
        dirty = true;
      }
      if (dirty) {
        app.save(r);
      }
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("role");
    users.fields.removeByName("active");
    app.save(users);
  },
);
