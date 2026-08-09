import assert from "node:assert/strict";
import test from "node:test";

import { apiEnvelopeSchema, errorEnvelopeSchema, eventCatalog, eventEnvelopeSchema, paginationSchema } from "../src/index.js";

test("contract identifiers remain versioned", () => {
  for (const schema of [apiEnvelopeSchema, errorEnvelopeSchema, eventEnvelopeSchema, paginationSchema]) {
    assert.match(schema.$id, /\.v1\.json$/);
  }
});

test("events are explicitly versioned", () => {
  assert.ok(Object.values(eventCatalog).every((name) => name.endsWith(".v1")));
  assert.equal(eventEnvelopeSchema.properties.schemaVersion.const, 1);
});

test("consumer event catalog contains no identity or publishing event", () => {
  const names = Object.values(eventCatalog).join(" ").toLowerCase();
  assert.doesNotMatch(names, /auth|login|account|publish|upload|post/);
});
