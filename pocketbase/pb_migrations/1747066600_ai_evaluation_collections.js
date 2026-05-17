migrate(
  (app) => {
    const portalUser =
      '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && (@request.auth.role = "admin" || @request.auth.role = "recruiter")';

    const submissionOnly =
      '@request.auth.id != "" && @request.auth.collectionName = "submission_service"';

    const portalRead = `(${portalUser}) || (${submissionOnly})`;
    const workerWrite = submissionOnly;
    const portalCreateRun = `(${portalUser} && @request.body.started_by = @request.auth.id) || (${submissionOnly})`;

    const applications = app.findCollectionByNameOrId("applications");
    const jobs = app.findCollectionByNameOrId("jobs");
    const users = app.findCollectionByNameOrId("users");

    const processingStatus = ["pending", "running", "complete", "failed", "skipped"];

    const applicationAiRuns = new Collection({
      type: "base",
      name: "application_ai_runs",
      listRule: portalRead,
      viewRule: portalRead,
      createRule: portalCreateRun,
      updateRule: workerWrite,
      deleteRule: null,
      fields: [
        {
          name: "application",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: applications.id,
          cascadeDelete: true,
        },
        {
          name: "run_type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["cv_validation", "github_evidence", "full_evaluation"],
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["requested", "running", "complete", "failed", "skipped"],
        },
        {
          name: "started_by",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        { name: "started_at", type: "date", required: false },
        { name: "completed_at", type: "date", required: false },
        { name: "error_message", type: "text", required: false },
        { name: "metadata", type: "json", required: false },
      ],
      indexes: [
        "CREATE INDEX idx_ai_runs_application ON application_ai_runs (application)",
        "CREATE INDEX idx_ai_runs_status ON application_ai_runs (status)",
      ],
    });

    app.save(applicationAiRuns);

    const applicationNormalizations = new Collection({
      type: "base",
      name: "application_normalizations",
      listRule: portalRead,
      viewRule: portalRead,
      createRule: workerWrite,
      updateRule: workerWrite,
      deleteRule: null,
      fields: [
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
          required: true,
          maxSelect: 1,
          collectionId: jobs.id,
          cascadeDelete: false,
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: processingStatus,
        },
        { name: "candidate_profile", type: "json", required: false },
        {
          name: "cv_original_format",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["pdf", "markdown"],
        },
        { name: "cv_original_file_name", type: "text", required: false },
        { name: "cv_extracted_markdown", type: "text", required: false },
        {
          name: "cv_extraction_status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["success", "failed"],
        },
        { name: "cv_extraction_warnings", type: "json", required: false },
        { name: "cv_word_count", type: "number", required: false },
        { name: "normalization_version", type: "text", required: false },
        { name: "error_message", type: "text", required: false },
      ],
      indexes: [
        "CREATE INDEX idx_app_norm_application ON application_normalizations (application)",
      ],
    });

    app.save(applicationNormalizations);

    const applicationAiValidations = new Collection({
      type: "base",
      name: "application_ai_validations",
      listRule: portalRead,
      viewRule: portalRead,
      createRule: workerWrite,
      updateRule: workerWrite,
      deleteRule: null,
      fields: [
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
          required: true,
          maxSelect: 1,
          collectionId: jobs.id,
          cascadeDelete: false,
        },
        {
          name: "normalization",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: applicationNormalizations.id,
          cascadeDelete: false,
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: processingStatus,
        },
        { name: "prompt_version", type: "text", required: false },
        { name: "response_schema_version", type: "text", required: false },
        { name: "model", type: "text", required: false },
        { name: "raw_model_output", type: "json", required: false },
        { name: "parsed_output", type: "json", required: false },
        { name: "required_skills_score", type: "number", required: false },
        { name: "nice_to_have_score", type: "number", required: false },
        { name: "evidence_coverage_score", type: "number", required: false },
        { name: "application_completeness_score", type: "number", required: false },
        { name: "cv_fit_score", type: "number", required: false },
        {
          name: "confidence",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["low", "medium", "high"],
        },
        { name: "summary", type: "text", required: false },
        { name: "strengths", type: "json", required: false },
        { name: "gaps", type: "json", required: false },
        { name: "concerns", type: "json", required: false },
        { name: "suggested_questions", type: "json", required: false },
        { name: "recruiter_report_md", type: "text", required: false },
        { name: "scoring_version", type: "text", required: false },
        { name: "error_message", type: "text", required: false },
      ],
      indexes: [
        "CREATE INDEX idx_app_ai_val_application ON application_ai_validations (application)",
      ],
    });

    app.save(applicationAiValidations);

    const applicationGithubEvidence = new Collection({
      type: "base",
      name: "application_github_evidence",
      listRule: portalRead,
      viewRule: portalRead,
      createRule: workerWrite,
      updateRule: workerWrite,
      deleteRule: null,
      fields: [
        {
          name: "application",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: applications.id,
          cascadeDelete: true,
        },
        {
          name: "validation",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: applicationAiValidations.id,
          cascadeDelete: false,
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            ...processingStatus,
            "not_provided",
            "invalid_url",
            "not_found",
            "rate_limited",
          ],
        },
        { name: "github_username", type: "text", required: false },
        { name: "github_profile_url", type: "url", required: false },
        { name: "profile_snapshot", type: "json", required: false },
        { name: "activity_metrics", type: "json", required: false },
        { name: "evidence_judgements", type: "json", required: false },
        { name: "github_evidence_score", type: "number", required: false },
        { name: "evidence_support_score", type: "number", required: false },
        {
          name: "confidence",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["low", "medium", "high"],
        },
        { name: "recruiter_report_md", type: "text", required: false },
        { name: "fetched_at", type: "date", required: false },
        { name: "github_snapshot_version", type: "text", required: false },
        { name: "github_activity_version", type: "text", required: false },
        { name: "comparison_version", type: "text", required: false },
        { name: "error_message", type: "text", required: false },
      ],
      indexes: [
        "CREATE INDEX idx_app_github_application ON application_github_evidence (application)",
      ],
    });

    app.save(applicationGithubEvidence);

    const applicationAiEvaluationReports = new Collection({
      type: "base",
      name: "application_ai_evaluation_reports",
      listRule: portalRead,
      viewRule: portalRead,
      createRule: workerWrite,
      updateRule: workerWrite,
      deleteRule: null,
      fields: [
        {
          name: "application",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: applications.id,
          cascadeDelete: true,
        },
        {
          name: "validation",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: applicationAiValidations.id,
          cascadeDelete: false,
        },
        {
          name: "github_evidence",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: applicationGithubEvidence.id,
          cascadeDelete: false,
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["complete", "partial", "failed"],
        },
        { name: "overall_fit_score", type: "number", required: false },
        { name: "cv_fit_score", type: "number", required: false },
        { name: "required_skills_score", type: "number", required: false },
        { name: "nice_to_have_score", type: "number", required: false },
        { name: "github_evidence_score", type: "number", required: false },
        { name: "evidence_support_score", type: "number", required: false },
        {
          name: "confidence",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["low", "medium", "high"],
        },
        { name: "flags", type: "json", required: false },
        {
          name: "recommendation",
          type: "select",
          required: false,
          maxSelect: 1,
          values: [
            "review_manually",
            "promising_match",
            "needs_clarification",
            "weak_match",
          ],
        },
        { name: "report_md", type: "text", required: false },
        { name: "report_version", type: "text", required: false },
      ],
      indexes: [
        "CREATE INDEX idx_app_ai_report_application ON application_ai_evaluation_reports (application)",
      ],
    });

    app.save(applicationAiEvaluationReports);
  },
  (app) => {
    const collectionNames = [
      "application_ai_evaluation_reports",
      "application_github_evidence",
      "application_ai_validations",
      "application_normalizations",
      "application_ai_runs",
    ];

    for (const name of collectionNames) {
      try {
        const col = app.findCollectionByNameOrId(name);
        const records = app.findRecordsByFilter(col.id, "1 = 1", "", 500, 0);
        for (let i = 0; i < records.length; i++) {
          app.delete(records[i]);
        }
        app.delete(col);
      } catch (_) {
        // collection may be missing
      }
    }
  },
);
