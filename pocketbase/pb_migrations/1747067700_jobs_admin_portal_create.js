migrate(
  (app) => {
    const portalAdmin =
      '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && @request.auth.role = "admin"';

    const jobs = app.findCollectionByNameOrId("jobs");
    jobs.createRule = portalAdmin;
    app.save(jobs);
  },
  (app) => {
    const jobs = app.findCollectionByNameOrId("jobs");
    jobs.createRule = null;
    app.save(jobs);
  },
);
