/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const portalUser =
      '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && (@request.auth.role = "admin" || @request.auth.role = "recruiter")';

    const submissionOnly =
      '@request.auth.id != "" && @request.auth.collectionName = "submission_service"';

    const portalRead = `(${portalUser}) || (${submissionOnly})`;
    const portalCreateRequest = `${portalUser} && @request.body.created_by = @request.auth.id`;
    const workerOrPortalUpdate = `(${portalUser}) || (${submissionOnly})`;

    const applications = app.findCollectionByNameOrId("applications");
    const jobs = app.findCollectionByNameOrId("jobs");
    const users = app.findCollectionByNameOrId("users");
    const emailLogsCol = app.findCollectionByNameOrId("email_logs");

    const appFieldNames = applications.fields.fieldNames() || [];

    if (!appFieldNames.includes("clarification_status")) {
      applications.fields.addAt(
        applications.fields.length,
        new SelectField({
          name: "clarification_status",
          required: false,
          maxSelect: 1,
          values: ["none", "requested", "seen", "answered", "expired", "cancelled"],
        }),
      );
    }
    if (!appFieldNames.includes("clarification_requested_at")) {
      applications.fields.addAt(
        applications.fields.length,
        new DateField({ name: "clarification_requested_at", required: false }),
      );
    }
    if (!appFieldNames.includes("clarification_seen_at")) {
      applications.fields.addAt(
        applications.fields.length,
        new DateField({ name: "clarification_seen_at", required: false }),
      );
    }
    if (!appFieldNames.includes("clarification_answered_at")) {
      applications.fields.addAt(
        applications.fields.length,
        new DateField({ name: "clarification_answered_at", required: false }),
      );
    }

    app.save(applications);

    const clarificationRequests = new Collection({
      type: "base",
      name: "clarification_requests",
      listRule: portalRead,
      viewRule: portalRead,
      createRule: portalCreateRequest,
      updateRule: workerOrPortalUpdate,
      deleteRule: null,
      fields: [
        {
          name: "public_token",
          type: "text",
          required: true,
          min: 32,
          max: 128,
        },
        {
          name: "application",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: applications.id,
          cascadeDelete: true,
        },
        {
          name: "job",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: jobs.id,
          cascadeDelete: false,
        },
        {
          name: "job_title",
          type: "text",
          required: true,
          min: 1,
          max: 500,
        },
        {
          name: "candidate_email",
          type: "email",
          required: true,
          max: 254,
        },
        {
          name: "candidate_name",
          type: "text",
          required: false,
          max: 500,
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["sent", "opened", "submitted", "expired", "cancelled"],
        },
        {
          name: "created_by",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        { name: "sent_at", type: "date", required: false },
        { name: "seen_at", type: "date", required: false },
        { name: "submitted_at", type: "date", required: false },
        { name: "expires_at", type: "date", required: true },
        { name: "candidate_email_sent_at", type: "date", required: false },
        {
          name: "candidate_email_log",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: emailLogsCol.id,
          cascadeDelete: false,
        },
        { name: "alert_email_sent_at", type: "date", required: false },
        {
          name: "alert_email_log",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: emailLogsCol.id,
          cascadeDelete: false,
        },
        { name: "submitted_user_agent", type: "text", required: false, max: 500 },
        { name: "seen_user_agent", type: "text", required: false, max: 500 },
        { name: "cancelled_at", type: "date", required: false },
        {
          name: "cancelled_by",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        { name: "cancel_reason", type: "text", required: false, max: 500 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_clarification_requests_public_token ON clarification_requests (public_token)",
        "CREATE INDEX idx_clarification_requests_application ON clarification_requests (application)",
      ],
    });

    app.save(clarificationRequests);

    if (!appFieldNames.includes("latest_clarification_request")) {
      applications.fields.addAt(
        applications.fields.length,
        new RelationField({
          name: "latest_clarification_request",
          required: false,
          maxSelect: 1,
          collectionId: clarificationRequests.id,
          cascadeDelete: false,
        }),
      );
      app.save(applications);
    }

    const clarificationItems = new Collection({
      type: "base",
      name: "clarification_items",
      listRule: portalRead,
      viewRule: portalRead,
      createRule: workerOrPortalUpdate,
      updateRule: submissionOnly,
      deleteRule: null,
      fields: [
        {
          name: "request",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: clarificationRequests.id,
          cascadeDelete: true,
        },
        { name: "position", type: "number", required: true, min: 0, max: 99 },
        {
          name: "question_text",
          type: "text",
          required: true,
          min: 1,
          max: 1000,
        },
        {
          name: "answer_text",
          type: "text",
          required: false,
          max: 5000,
        },
        {
          name: "source",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["ai_suggested", "recruiter_edited", "recruiter_added"],
        },
        { name: "answered_at", type: "date", required: false },
      ],
      indexes: ["CREATE INDEX idx_clarification_items_request ON clarification_items (request)"],
    });

    app.save(clarificationItems);

    const templateField = emailLogsCol.fields.getByName("template");
    const existingTemplates = templateField.values || [];
    const nextTemplates = [...existingTemplates];
    for (const t of ["clarification_request", "clarification_completed_alert"]) {
      if (!nextTemplates.includes(t)) {
        nextTemplates.push(t);
      }
    }
    templateField.values = nextTemplates;

    const emailFieldNames = emailLogsCol.fields.fieldNames() || [];
    if (!emailFieldNames.includes("clarification_request")) {
      emailLogsCol.fields.addAt(
        emailLogsCol.fields.length,
        new RelationField({
          name: "clarification_request",
          required: false,
          maxSelect: 1,
          collectionId: clarificationRequests.id,
          cascadeDelete: false,
        }),
      );
    }

    app.save(emailLogsCol);
  },
  (app) => {
    try {
      const items = app.findCollectionByNameOrId("clarification_items");
      app.delete(items);
    } catch (_) {}

    try {
      const requests = app.findCollectionByNameOrId("clarification_requests");
      app.delete(requests);
    } catch (_) {}

    const applications = app.findCollectionByNameOrId("applications");
    for (const name of [
      "latest_clarification_request",
      "clarification_status",
      "clarification_requested_at",
      "clarification_seen_at",
      "clarification_answered_at",
    ]) {
      try {
        applications.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(applications);

    const emailLogsCol = app.findCollectionByNameOrId("email_logs");
    try {
      emailLogsCol.fields.removeByName("clarification_request");
    } catch (_) {}
    const templateField = emailLogsCol.fields.getByName("template");
    templateField.values = (templateField.values || []).filter(
      (v) => v !== "clarification_request" && v !== "clarification_completed_alert",
    );
    app.save(emailLogsCol);
  },
);
