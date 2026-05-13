migrate((app) => {
  const collectionNames = ["email_logs", "application_notes", "applications", "jobs"];

  for (const name of collectionNames) {
    const count = app.findAllRecords(name).length;
    if (count > 0) {
      throw new Error(
        `Cannot automatically switch to the single-markdown schema because the ${name} collection already contains data.`,
      );
    }
  }

  for (const name of collectionNames) {
    try {
      const collection = app.findCollectionByNameOrId(name);
      app.delete(collection);
    } catch (_) {
      // Ignore missing collections.
    }
  }

  const jobs = new Collection({
    type: "base",
    name: "jobs",
    listRule: 'status = "published"',
    viewRule: 'status = "published"',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "slug", type: "text", required: true, min: 1, max: 120, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
      { name: "title", type: "text", required: true, min: 1, max: 200 },
      { name: "summary", type: "text", required: true, min: 1, max: 1000, help: "Short summary shown on the public jobs list." },
      { name: "description", type: "text", required: true, help: "Full job description in raw Markdown." },
      { name: "whatToExpect", type: "text", required: false, help: "Optional benefits, perks, or other candidate-facing expectations in raw Markdown." },
      { name: "workModel", type: "select", required: true, maxSelect: 1, values: ["remote", "hybrid", "onsite"], help: "How the role is structured for work location." },
      { name: "workLocation", type: "text", required: false, max: 120, help: "Optional location detail such as city, country, or timezone overlap." },
      { name: "employmentType", type: "select", required: true, maxSelect: 1, values: ["full_time", "part_time", "contract", "internship"], help: "Type of employment for the role." },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["draft", "published", "archived"] },
      { name: "requiredSkills", type: "text", required: false, help: "Required skills, one per line." },
      { name: "niceToHaveSkills", type: "text", required: false, help: "Optional or bonus skills, one per line." },
      { name: "hiringProcess", type: "text", required: false, help: "Optional hiring-process content in raw Markdown." },
      { name: "publishedAt", type: "date", required: false, help: "Set the first time the role is published." },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_jobs_slug ON jobs (slug)",
      "CREATE INDEX idx_jobs_status ON jobs (status)",
      "CREATE INDEX idx_jobs_published_at ON jobs (publishedAt)",
    ],
  });
  app.save(jobs);

  const applications = new Collection({
    type: "base",
    name: "applications",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "job", type: "relation", required: true, maxSelect: 1, collectionId: jobs.id, cascadeDelete: false },
      { name: "full_name", type: "text", required: true, min: 1, max: 120 },
      { name: "email", type: "email", required: true, max: 254 },
      { name: "phone_number", type: "text", required: false, max: 40 },
      { name: "location", type: "text", required: false, max: 120 },
      { name: "timezone", type: "text", required: false, max: 80 },
      { name: "github_url", type: "url", required: false, max: 300 },
      { name: "portfolio_url", type: "url", required: false, max: 300 },
      { name: "linkedin_url", type: "url", required: false, max: 300 },
      { name: "anything_else", type: "text", required: false, max: 2000 },
      { name: "cv_file", type: "file", required: true, maxSelect: 1, maxSize: 5242880, mimeTypes: ["application/pdf", "text/plain", "text/markdown", "text/x-markdown"] },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["new", "reviewing", "maybe", "rejected", "interview", "offer", "hired", "withdrawn"] },
      { name: "duplicate_key", type: "text", required: true, min: 1, max: 255 },
      { name: "consent_to_store_data", type: "bool", required: true },
      { name: "source", type: "text", required: false, max: 120 },
      { name: "user_agent", type: "text", required: false, max: 500 },
      { name: "submitted_at", type: "date", required: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_applications_duplicate_key ON applications (duplicate_key)",
      "CREATE INDEX idx_applications_job ON applications (job)",
      "CREATE INDEX idx_applications_status ON applications (status)",
      "CREATE INDEX idx_applications_submitted_at ON applications (submitted_at)",
      "CREATE INDEX idx_applications_email ON applications (email)",
    ],
  });
  app.save(applications);

  const applicationNotes = new Collection({
    type: "base",
    name: "application_notes",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "application", type: "relation", required: true, maxSelect: 1, collectionId: applications.id, cascadeDelete: true },
      { name: "body", type: "text", required: true, min: 1 },
    ],
  });
  app.save(applicationNotes);

  const emailLogs = new Collection({
    type: "base",
    name: "email_logs",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "application", type: "relation", required: true, maxSelect: 1, collectionId: applications.id, cascadeDelete: true },
      { name: "template", type: "select", required: true, maxSelect: 1, values: ["application_received"] },
      { name: "recipient", type: "email", required: true, max: 254 },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["sent", "failed"] },
      { name: "provider", type: "text", required: true, min: 1, max: 50 },
      { name: "provider_message_id", type: "text", required: false, max: 255 },
      { name: "error_message", type: "text", required: false, max: 2000 },
    ],
  });
  app.save(emailLogs);
});
