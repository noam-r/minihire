migrate(
  (app) => {
    // PocketBase ships a default `users` auth collection; extend it instead of creating a duplicate.
    const users = app.findCollectionByNameOrId("users");
    const fieldNames = users.fields.fieldNames() || [];

    if (!fieldNames.includes("role")) {
      users.fields.addMarshaledJSON(
        '{"type":"select","name":"role","required":true,"maxSelect":1,"values":["admin","recruiter"]}',
      );
    }

    if (!fieldNames.includes("active")) {
      users.fields.addMarshaledJSON('{"type":"bool","name":"active","required":true}');
    }

    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    users.updateRule = "id = @request.auth.id";
    users.createRule = null;
    users.deleteRule = null;

    app.save(users);

    const portalUser =
      '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && (@request.auth.role = "admin" || @request.auth.role = "recruiter")';

    const submissionOnly =
      '@request.auth.id != "" && @request.auth.collectionName = "submission_service"';

    const applications = app.findCollectionByNameOrId("applications");
    applications.listRule = `(${submissionOnly}) || (${portalUser})`;
    applications.viewRule = `(${submissionOnly}) || (${portalUser})`;
    applications.createRule = submissionOnly;
    applications.updateRule = portalUser;
    app.save(applications);

    const jobs = app.findCollectionByNameOrId("jobs");
    jobs.listRule = `(status = "published") || (${portalUser})`;
    jobs.viewRule = `(status = "published") || (${portalUser})`;
    app.save(jobs);

    const applicationNotes = app.findCollectionByNameOrId("application_notes");
    try {
      applicationNotes.fields.getByName("author");
    } catch (_) {
      applicationNotes.fields.addAt(applicationNotes.fields.length, {
        name: "author",
        type: "relation",
        required: false,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: false,
      });
    }
    app.save(applicationNotes);

    applicationNotes.listRule = portalUser;
    applicationNotes.viewRule = portalUser;
    applicationNotes.createRule = `${portalUser} && @request.body.author = @request.auth.id`;
    app.save(applicationNotes);

    const applicationsRef = app.findCollectionByNameOrId("applications");
    const usersRef = app.findCollectionByNameOrId("users");

    const applicationStatusHistory = new Collection({
      type: "base",
      name: "application_status_history",
      listRule: portalUser,
      viewRule: portalUser,
      createRule: portalUser,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: "application",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: applicationsRef.id,
          cascadeDelete: false,
        },
        { name: "from_status", type: "text", required: false, max: 40 },
        { name: "to_status", type: "text", required: true, max: 40 },
        {
          name: "changed_by",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersRef.id,
          cascadeDelete: false,
        },
        { name: "reason", type: "text", required: false, max: 2000 },
      ],
      indexes: ["CREATE INDEX idx_app_status_hist_application ON application_status_history (application)"],
    });

    app.save(applicationStatusHistory);
  },
  (app) => {
    try {
      const applicationStatusHistory = app.findCollectionByNameOrId("application_status_history");
      const records = app.findRecordsByFilter(applicationStatusHistory.id, "1 = 1", "", 500, 0);
      for (let i = 0; i < records.length; i++) {
        app.delete(records[i]);
      }
      app.delete(applicationStatusHistory);
    } catch (_) {
      // collection may be missing
    }

    const applicationNotes = app.findCollectionByNameOrId("application_notes");
    try {
      applicationNotes.fields.removeByName("author");
    } catch (_) {
      // field may be missing
    }
    applicationNotes.listRule = null;
    applicationNotes.viewRule = null;
    applicationNotes.createRule = null;
    app.save(applicationNotes);

    const jobs = app.findCollectionByNameOrId("jobs");
    jobs.listRule = 'status = "published"';
    jobs.viewRule = 'status = "published"';
    app.save(jobs);

    const applications = app.findCollectionByNameOrId("applications");
    const submissionOnly =
      '@request.auth.id != "" && @request.auth.collectionName = "submission_service"';
    applications.listRule = submissionOnly;
    applications.viewRule = submissionOnly;
    applications.createRule = submissionOnly;
    applications.updateRule = null;
    app.save(applications);

    const users = app.findCollectionByNameOrId("users");
    try {
      users.fields.removeByName("role");
    } catch (_) {
      // field may be missing
    }
    try {
      users.fields.removeByName("active");
    } catch (_) {
      // field may be missing
    }
    // Restore common defaults for the stock `users` auth collection (superusers still bypass rules).
    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    users.updateRule = "id = @request.auth.id";
    app.save(users);
  },
);
