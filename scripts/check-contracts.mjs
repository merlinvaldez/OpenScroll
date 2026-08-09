import assert from "node:assert/strict"; import { readFile } from "node:fs/promises";
import { apiEnvelopeSchema, errorEnvelopeSchema, eventCatalog, paginationSchema } from "../packages/contracts/src/index.js";
const baseline = JSON.parse(await readFile(new URL("../packages/contracts/baseline/contracts.v1.json", import.meta.url)));
assert.equal(apiEnvelopeSchema.$id, baseline.api, "Changing a v1 contract ID is breaking; add v2 instead");
for (const field of baseline.errorRequired) assert.ok(errorEnvelopeSchema.required.includes(field), `Removed required error field: ${field}`);
for (const field of baseline.paginationRequired) assert.ok(paginationSchema.required.includes(field), `Removed required pagination field: ${field}`);
const currentEvents = Object.values(eventCatalog); for (const event of baseline.events) assert.ok(currentEvents.includes(event), `Removed v1 event: ${event}`);
console.log("Contract compatibility check passed");
