/// <reference path="../pb_data/types.d.ts" />

/** Default PocketBase text max is 5000; extracted CVs and reports can be much longer. */
const LONG_TEXT_MAX = 100_000;

function setTextFieldMax(collection, fieldName, max) {
  const field = collection.fields.getByName(fieldName);
  if (field && "max" in field) {
    field.max = max;
  }
}

migrate(
  (app) => {
    const normalizations = app.findCollectionByNameOrId("application_normalizations");
    setTextFieldMax(normalizations, "cv_extracted_markdown", LONG_TEXT_MAX);
    app.save(normalizations);

    const validations = app.findCollectionByNameOrId("application_ai_validations");
    setTextFieldMax(validations, "recruiter_report_md", LONG_TEXT_MAX);
    setTextFieldMax(validations, "summary", LONG_TEXT_MAX);
    app.save(validations);

    const reports = app.findCollectionByNameOrId("application_ai_evaluation_reports");
    setTextFieldMax(reports, "report_md", LONG_TEXT_MAX);
    app.save(reports);
  },
  (app) => {
    const normalizations = app.findCollectionByNameOrId("application_normalizations");
    setTextFieldMax(normalizations, "cv_extracted_markdown", 5000);
    app.save(normalizations);

    const validations = app.findCollectionByNameOrId("application_ai_validations");
    setTextFieldMax(validations, "recruiter_report_md", 5000);
    setTextFieldMax(validations, "summary", 5000);
    app.save(validations);

    const reports = app.findCollectionByNameOrId("application_ai_evaluation_reports");
    setTextFieldMax(reports, "report_md", 5000);
    app.save(reports);
  },
);
