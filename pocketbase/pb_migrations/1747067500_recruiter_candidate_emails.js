/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const emailLogsCol = app.findCollectionByNameOrId("email_logs");
    const users = app.findCollectionByNameOrId("users");

    const templateField = emailLogsCol.fields.getByName("template");
    const existingTemplates = templateField.values || [];
    const nextTemplates = [...existingTemplates];
    for (const t of ["application_rejected", "free_text_clarification"]) {
      if (!nextTemplates.includes(t)) {
        nextTemplates.push(t);
      }
    }
    templateField.values = nextTemplates;

    const fieldNames = emailLogsCol.fields.fieldNames() || [];

    if (!fieldNames.includes("subject")) {
      emailLogsCol.fields.addAt(
        emailLogsCol.fields.length,
        new TextField({
          name: "subject",
          required: false,
          max: 255,
        }),
      );
    }

    if (!fieldNames.includes("body")) {
      emailLogsCol.fields.addAt(
        emailLogsCol.fields.length,
        new TextField({
          name: "body",
          required: false,
          max: 8000,
        }),
      );
    }

    if (!fieldNames.includes("sent_by")) {
      emailLogsCol.fields.addAt(
        emailLogsCol.fields.length,
        new RelationField({
          name: "sent_by",
          required: false,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        }),
      );
    }

    app.save(emailLogsCol);
  },
  (app) => {
    const emailLogsCol = app.findCollectionByNameOrId("email_logs");

    for (const name of ["subject", "body", "sent_by"]) {
      try {
        emailLogsCol.fields.removeByName(name);
      } catch (_) {
        // Field may already be absent.
      }
    }

    const templateField = emailLogsCol.fields.getByName("template");
    templateField.values = (templateField.values || []).filter(
      (v) => v !== "application_rejected" && v !== "free_text_clarification",
    );
    app.save(emailLogsCol);
  },
);
