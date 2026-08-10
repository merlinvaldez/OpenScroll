import assert from "node:assert/strict"; import test from "node:test";
import { apiEnvelopeSchema, errorEnvelopeSchema, eventCatalog, eventEnvelopeSchema, paginationSchema } from "../src/index.js";
test("all public contracts are immutable and versioned", () => { for (const schema of [apiEnvelopeSchema, errorEnvelopeSchema, eventEnvelopeSchema, paginationSchema]) { assert.match(schema.$id, /\.v1\.json$/); assert.ok(Object.isFrozen(schema)); } });
test("errors and pagination have standardized fields", () => { assert.deepEqual(errorEnvelopeSchema.required, ["code", "message", "requestId"]); assert.deepEqual(paginationSchema.required, ["nextCursor", "hasMore"]); });
test("consumer event catalog excludes identity and publishing", () => assert.doesNotMatch(Object.values(eventCatalog).join(" "), /auth|login|account|publish|upload|post/i));
