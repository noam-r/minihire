/// <reference path="../pb_data/types.d.ts" />

/**
 * Allow submission_service (AI worker, backfill CLI) to update applications.
 * Used to sync denormalized inbox fields (AI scores, status_changed_at on backfill).
 * Account is server-only (see POCKETBASE_SUBMISSION_SERVICE_* in .env).
 */
migrate(
  (app) => {
    const portalUser =
      '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && (@request.auth.role = "admin" || @request.auth.role = "recruiter")';

    const submissionOnly =
      '@request.auth.id != "" && @request.auth.collectionName = "submission_service"';

    const applications = app.findCollectionByNameOrId("applications");
    applications.updateRule = `(${portalUser}) || (${submissionOnly})`;
    app.save(applications);
  },
  (app) => {
    const portalUser =
      '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && (@request.auth.role = "admin" || @request.auth.role = "recruiter")';

    const applications = app.findCollectionByNameOrId("applications");
    applications.updateRule = portalUser;
    app.save(applications);
  },
);
