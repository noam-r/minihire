/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const applications = app.findCollectionByNameOrId("applications");
    const names = applications.fields.fieldNames() || [];

    if (!names.includes("cv_fit_score")) {
      applications.fields.addAt(
        applications.fields.length,
        new NumberField({
          name: "cv_fit_score",
          required: false,
          min: 0,
          max: 5,
        }),
      );
    }

    if (!names.includes("required_skills_score")) {
      applications.fields.addAt(
        applications.fields.length,
        new NumberField({
          name: "required_skills_score",
          required: false,
          min: 0,
          max: 5,
        }),
      );
    }

    if (!names.includes("nice_to_have_score")) {
      applications.fields.addAt(
        applications.fields.length,
        new NumberField({
          name: "nice_to_have_score",
          required: false,
          min: 0,
          max: 5,
        }),
      );
    }

    if (!names.includes("ai_evaluated_at")) {
      applications.fields.addAt(
        applications.fields.length,
        new DateField({
          name: "ai_evaluated_at",
          required: false,
        }),
      );
    }

    if (!names.includes("status_changed_at")) {
      applications.fields.addAt(
        applications.fields.length,
        new DateField({
          name: "status_changed_at",
          required: false,
        }),
      );
    }

    app.save(applications);

    const indexes = applications.indexes || [];
    const statusIdx = "CREATE INDEX idx_applications_status_changed_at ON applications (status_changed_at)";
    if (!indexes.includes(statusIdx)) {
      applications.indexes = [...indexes, statusIdx];
      app.save(applications);
    }
  },
  (app) => {
    const applications = app.findCollectionByNameOrId("applications");
    for (const name of [
      "cv_fit_score",
      "required_skills_score",
      "nice_to_have_score",
      "ai_evaluated_at",
      "status_changed_at",
    ]) {
      try {
        applications.fields.removeByName(name);
      } catch (_) {
        // Field may already be absent.
      }
    }
    applications.indexes = (applications.indexes || []).filter(
      (idx) => !String(idx).includes("idx_applications_status_changed_at"),
    );
    app.save(applications);
  },
);
