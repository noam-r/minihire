migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("application_ai_runs");
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
