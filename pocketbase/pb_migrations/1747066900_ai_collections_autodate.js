const AI_COLLECTIONS = [
  "application_ai_runs",
  "application_normalizations",
  "application_ai_validations",
  "application_github_evidence",
  "application_ai_evaluation_reports",
];

migrate(
  (app) => {
    for (const name of AI_COLLECTIONS) {
      const collection = app.findCollectionByNameOrId(name);

      if (!collection.fields.getByName("created")) {
        collection.fields.addMarshaledJSON(
          '{"type":"autodate","name":"created","onCreate":true,"onUpdate":false}',
        );
      }
      if (!collection.fields.getByName("updated")) {
        collection.fields.addMarshaledJSON(
          '{"type":"autodate","name":"updated","onCreate":true,"onUpdate":true}',
        );
      }

      app.save(collection);
    }
  },
  (app) => {
    for (const name of AI_COLLECTIONS) {
      try {
        const collection = app.findCollectionByNameOrId(name);
        try {
          collection.fields.removeByName("created");
        } catch (_) {
          // field may be missing
        }
        try {
          collection.fields.removeByName("updated");
        } catch (_) {
          // field may be missing
        }
        app.save(collection);
      } catch (_) {
        // Collection may already be missing.
      }
    }
  },
);
