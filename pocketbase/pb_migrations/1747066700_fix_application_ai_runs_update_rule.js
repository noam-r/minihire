migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("application_ai_runs");
    // Allow submission_service to update run status (worker). Use collectionId because
    // collectionName checks were not matching for updates on this collection in practice.
    const submissionService = app.findCollectionByNameOrId("submission_service");
    collection.updateRule = `@request.auth.id != "" && @request.auth.collectionId = "${submissionService.id}"`;
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("application_ai_runs");
    collection.updateRule =
      '@request.auth.id != "" && @request.auth.collectionName = "submission_service"';
    app.save(collection);
  },
);
