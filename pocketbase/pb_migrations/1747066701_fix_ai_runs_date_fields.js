migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("application_ai_runs");

    try {
      collection.fields.removeByName("started_at");
    } catch (_) {
      // field may be missing
    }
    try {
      collection.fields.removeByName("completed_at");
    } catch (_) {
      // field may be missing
    }

    collection.fields.addMarshaledJSON('{"type":"date","name":"started_at","required":false}');
    collection.fields.addMarshaledJSON('{"type":"date","name":"completed_at","required":false}');

    collection.updateRule =
      '@request.auth.id != "" && @request.auth.collectionName = "submission_service"';

    app.save(collection);

    const records = app.findRecordsByFilter(collection.id, "1 = 1", "", 500, 0);
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      let changed = false;
      if (record.getString("started_at") === "") {
        record.set("started_at", null);
        changed = true;
      }
      if (record.getString("completed_at") === "") {
        record.set("completed_at", null);
        changed = true;
      }
      if (changed) {
        app.save(record);
      }
    }
  },
  (app) => {
  },
);
