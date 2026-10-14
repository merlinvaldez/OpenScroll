import assert from "node:assert/strict"; import { readFile } from "node:fs/promises";
import { apiEnvelopeSchema, errorEnvelopeSchema, eventCatalog, paginationSchema, universalContentObjectSchema, sourceRegistryRecordSchema, connectorRunSchema, ingestionRunSchema } from "../packages/contracts/src/index.js";
import { attributionNoticeSchema, licenseOntologySchema, openLicenseGateDecisionSchema, rightsReviewCaseSchema, rightsSafeDownloadPolicySchema } from "../packages/contracts/src/legacy-schemas.js";
const baseline = JSON.parse(await readFile(new URL("../packages/contracts/baseline/contracts.v1.json", import.meta.url)));
assert.equal(apiEnvelopeSchema.$id, baseline.api, "Changing a v1 contract ID is breaking; add v2 instead");
for (const field of baseline.errorRequired) assert.ok(errorEnvelopeSchema.required.includes(field), `Removed required error field: ${field}`);
for (const field of baseline.paginationRequired) assert.ok(paginationSchema.required.includes(field), `Removed required pagination field: ${field}`);
const currentEvents = Object.values(eventCatalog); for (const event of baseline.events) assert.ok(currentEvents.includes(event), `Removed v1 event: ${event}`);
const rightsSchemas = [licenseOntologySchema, openLicenseGateDecisionSchema, rightsReviewCaseSchema, attributionNoticeSchema, rightsSafeDownloadPolicySchema].map((schema) => schema.$id);
for (const contractId of baseline.rights || []) assert.ok(rightsSchemas.includes(contractId), `Removed v1 rights contract: ${contractId}`);
for (const schema of [universalContentObjectSchema, sourceRegistryRecordSchema, connectorRunSchema, ingestionRunSchema]) {
  assert.match(schema.$id, /\.v2\.json$/);
  for (const field of ["rights", "rightsModel", "reviewQueue"]) assert.ok(!schema.required.includes(field));
}
console.log("Contract compatibility check passed (archived v1, active v2)");
