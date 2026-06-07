/// <reference path="../pb_data/types.d.ts" />

/**
 * AI worker (submission_service) must read job records for applications it evaluates,
 * including draft/archived roles that are no longer on the public careers site.
 */
migrate(
  (app) => {
    const portalUser =
      '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && (@request.auth.role = "admin" || @request.auth.role = "recruiter")';

    const submissionOnly =
      '@request.auth.id != "" && @request.auth.collectionName = "submission_service"';

    const jobs = app.findCollectionByNameOrId("jobs");
    jobs.listRule = `(status = "published") || (${portalUser}) || (${submissionOnly})`;
    jobs.viewRule = `(status = "published") || (${portalUser}) || (${submissionOnly})`;
    app.save(jobs);
  },
  (app) => {
    const portalUser =
      '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && (@request.auth.role = "admin" || @request.auth.role = "recruiter")';

    const jobs = app.findCollectionByNameOrId("jobs");
    jobs.listRule = `(status = "published") || (${portalUser})`;
    jobs.viewRule = `(status = "published") || (${portalUser})`;
    app.save(jobs);
  },
);
