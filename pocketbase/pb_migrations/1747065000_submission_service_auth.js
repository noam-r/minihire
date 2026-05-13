migrate(
  (app) => {
    const submissionService = new Collection({
      type: "auth",
      name: "submission_service",
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      passwordAuth: {
        enabled: true,
      },
      indexes: [],
    });

    app.save(submissionService);

    const scopedAuth = `@request.auth.id != "" && @request.auth.collectionName = "submission_service"`;

    const applications = app.findCollectionByNameOrId("applications");
    applications.createRule = scopedAuth;
    applications.listRule = scopedAuth;
    applications.viewRule = scopedAuth;
    app.save(applications);

    const emailLogs = app.findCollectionByNameOrId("email_logs");
    emailLogs.createRule = scopedAuth;
    emailLogs.listRule = scopedAuth;
    emailLogs.viewRule = scopedAuth;
    app.save(emailLogs);

    const email =
      $os.getenv("POCKETBASE_SUBMISSION_SERVICE_EMAIL") || "application-service@internal.local";
    const password = $os.getenv("POCKETBASE_SUBMISSION_SERVICE_PASSWORD");

    if (!password || password.length < 10) {
      return;
    }

    try {
      app.findAuthRecordByEmail("submission_service", email);
      return;
    } catch (_) {
      // No existing auth record — create the service account.
    }

    const record = new Record(submissionService);
    record.setEmail(email);
    record.setPassword(password);
    record.setVerified(true);
    app.save(record);
  },
  (app) => {
    const applications = app.findCollectionByNameOrId("applications");
    applications.createRule = null;
    applications.listRule = null;
    applications.viewRule = null;
    app.save(applications);

    const emailLogs = app.findCollectionByNameOrId("email_logs");
    emailLogs.createRule = null;
    emailLogs.listRule = null;
    emailLogs.viewRule = null;
    app.save(emailLogs);

    try {
      const col = app.findCollectionByNameOrId("submission_service");
      const records = app.findRecordsByFilter(col.id, "1 = 1", "", 500, 0);

      for (let i = 0; i < records.length; i++) {
        app.delete(records[i]);
      }

      app.delete(col);
    } catch (_) {
      // Collection may already be missing.
    }
  },
);
