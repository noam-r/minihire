/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const applications = app.findCollectionByNameOrId("applications");
    const names = applications.fields.fieldNames() || [];

    if (!names.includes("starred")) {
      applications.fields.addAt(
        applications.fields.length,
        new BoolField({
          name: "starred",
          required: false,
        }),
      );
    }

    app.save(applications);

    const indexes = applications.indexes || [];
    const starredIdx = "CREATE INDEX idx_applications_starred ON applications (starred)";
    if (!indexes.includes(starredIdx)) {
      applications.indexes = [...indexes, starredIdx];
      app.save(applications);
    }
  },
  (app) => {
    const applications = app.findCollectionByNameOrId("applications");
    try {
      applications.fields.removeByName("starred");
    } catch (_) {
      // Field may already be absent.
    }
    applications.indexes = (applications.indexes || []).filter(
      (idx) => !String(idx).includes("idx_applications_starred"),
    );
    app.save(applications);
  },
);
