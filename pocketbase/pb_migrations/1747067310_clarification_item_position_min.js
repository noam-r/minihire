/// <reference path="../pb_data/types.d.ts" />

/** PocketBase rejects 0 for required number fields; align schema min with 1-based positions. */
migrate(
  (app) => {
    const items = app.findCollectionByNameOrId("clarification_items");
    const position = items.fields.getByName("position");
    position.min = 1;
    app.save(items);
  },
  (app) => {
    const items = app.findCollectionByNameOrId("clarification_items");
    const position = items.fields.getByName("position");
    position.min = 0;
    app.save(items);
  },
);
