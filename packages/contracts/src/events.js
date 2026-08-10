export const eventCatalog = Object.freeze({
  INTEREST_ENTERED: "interest.entered.v1",
  TOPIC_SELECTED: "topic.selected.v1",
  SCROLL_CREATED: "scroll.created.v1",
  PREFERENCE_CHANGED_LOCAL: "preference.changed-local.v1",
  ITEM_SAVED_LOCAL: "item.saved-local.v1",
  LOCAL_DATA_EXPORTED: "local-data.exported.v1",
  LOCAL_DATA_IMPORTED: "local-data.imported.v1",
  LOCAL_DATA_RESET: "local-data.reset.v1"
});
export const eventEnvelopeSchema = Object.freeze({ $id: "https://openscroll.app/contracts/event-envelope.v1.json", type: "object", additionalProperties: false, required: ["id", "name", "occurredAt", "schemaVersion", "payload"], properties: { id: { type: "string", minLength: 1 }, name: { enum: Object.values(eventCatalog) }, occurredAt: { type: "string", format: "date-time" }, schemaVersion: { const: 1 }, payload: { type: "object" } } });
