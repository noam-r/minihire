migrate((app) => {
  const jobs = app.findCollectionByNameOrId("jobs");
  jobs.fields.addAt(4, new TextField({
    name: "whatToExpect",
    required: false,
    help: "Optional benefits, perks, or other candidate-facing expectations in raw Markdown.",
  }));
  app.save(jobs);

  const applications = app.findCollectionByNameOrId("applications");
  applications.fields.addAt(3, new TextField({
    name: "phone_number",
    required: false,
    max: 40,
  }));
  applications.fields.removeByName("why_this_role");
  applications.fields.removeByName("agent_experience");
  applications.fields.addAt(8, new TextField({
    name: "anything_else",
    required: false,
    max: 2000,
  }));
  app.save(applications);
});
