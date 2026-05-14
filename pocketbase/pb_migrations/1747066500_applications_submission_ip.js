/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const applications = app.findCollectionByNameOrId("applications");
    const names = applications.fields.fieldNames() || [];

    if (!names.includes("submission_ip")) {
      applications.fields.addAt(applications.fields.length, new TextField({
        name: "submission_ip",
        required: false,
        max: 45,
        help: "Client IP when the application was submitted (from proxy headers when present).",
      }));
    }

    if (!names.includes("submission_ip_location")) {
      applications.fields.addAt(applications.fields.length, new TextField({
        name: "submission_ip_location",
        required: false,
        max: 200,
        help: "Approximate location (city/region/country) inferred from submission_ip when lookup succeeds.",
      }));
    }

    app.save(applications);
  },
  (app) => {
    const applications = app.findCollectionByNameOrId("applications");
    try {
      applications.fields.removeByName("submission_ip");
    } catch (_) {
      // Field may already be absent.
    }
    try {
      applications.fields.removeByName("submission_ip_location");
    } catch (_) {
      // Field may already be absent.
    }
    app.save(applications);
  },
);
