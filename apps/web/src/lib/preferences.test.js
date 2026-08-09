import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PREFERENCES, parsePreferences } from "./preferences.js";
test("preferences fail safely when corrupted", () => assert.deepEqual(parsePreferences("{"), DEFAULT_PREFERENCES));
test("preferences reject unsupported locale and theme", () => {
  const value = parsePreferences(JSON.stringify({ locale: "xx", theme: "neon", topics: ["Music", 2] }));
  assert.equal(value.locale, "en"); assert.equal(value.theme, "system"); assert.deepEqual(value.topics, ["Music"]);
});
