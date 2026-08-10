import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PREFERENCES,
  buildLocalExport,
  clearLocalHistory,
  createDefaultLocalState,
  loadLocalData,
  normalizeLocalState,
  parseLocalImport,
  parsePreferences,
  preferencesFromState,
  recordExplicitFeedback,
  recordScrollCreation,
  serializeLocalExport,
  storageStatusFromError,
  toggleSavedItem,
  updateLocalSettings
} from "./preferences.js";

test("preferences fail safely when corrupted", () => assert.deepEqual(parsePreferences("{"), { ...DEFAULT_PREFERENCES, topics: [...DEFAULT_PREFERENCES.topics] }));

test("preferences reject unsupported locale and theme", () => {
  const value = parsePreferences(JSON.stringify({ locale: "xx", theme: "neon", topics: ["Music", 2] }));
  assert.equal(value.locale, "en");
  assert.equal(value.theme, "system");
  assert.deepEqual(value.topics, ["Music"]);
});

test("boot preferences migrate into local state without an account", () => {
  const state = normalizeLocalState({ settings: { locale: "ar", theme: "dark" }, scrolls: [{ interest: "Morocco", topics: ["Darija"] }] });
  const preferences = preferencesFromState(state);
  assert.equal(preferences.interest, "Morocco");
  assert.deepEqual(preferences.topics, ["Darija"]);
  assert.equal(preferences.locale, "ar");
  assert.equal(preferences.theme, "dark");
});

test("settings merge locally without resetting neighboring controls", () => {
  const state = updateLocalSettings(createDefaultLocalState(), { media: { video: false }, privacy: { saveHistory: false } });
  assert.equal(state.settings.media.video, false);
  assert.equal(state.settings.media.audio, true);
  assert.equal(state.settings.privacy.saveHistory, false);
  assert.equal(state.settings.privacy.explicitSignalsOnly, true);
});

test("scroll creation stores implicit history only when enabled", () => {
  const state = recordScrollCreation(createDefaultLocalState(), { interest: "Morocco", topics: ["Music", "History"] });
  assert.equal(state.scrolls[0].interest, "Morocco");
  assert.equal(state.history[0].signal, "implicit");
  const noHistory = recordScrollCreation(updateLocalSettings(createDefaultLocalState(), { privacy: { saveHistory: false } }), { interest: "Morocco", topics: ["Music"] });
  assert.equal(noHistory.history.length, 0);
});

test("scroll creation stores sanitized Interest Graph snapshots locally", () => {
  const state = recordScrollCreation(createDefaultLocalState(), {
    interest: "Morocco",
    topics: ["Music", "Darija"],
    graphSnapshot: {
      schemaVersion: "interest-graph.v1",
      id: "interest-graph:morocco:music:darija",
      root: { label: "Morocco", nodeId: "interest:morocco", entityId: "wd:Q1028", resolutionStatus: "resolved" },
      selectedTopics: ["Music", "Darija"],
      excludedTopics: ["Shopping"],
      weights: { Music: 0.92, Darija: 0.84 },
      preferences: { media: { video: false }, sources: { openverse: false }, languages: ["en", "ar"], depth: 3, surprise: 0.3 }
    }
  });
  assert.equal(state.scrolls[0].graphSnapshot.root.entityId, "wd:Q1028");
  assert.equal(state.scrolls[0].graphSnapshot.preferences.media.video, false);
  assert.equal(state.scrolls[0].graphSnapshot.preferences.sources.openverse, false);
  assert.deepEqual(state.scrolls[0].graphSnapshot.selectedTopics, ["Music", "Darija"]);
});

test("saves and explicit feedback remain browser-local records", () => {
  const card = { id: "commons-gnawa-pulse", title: "The living pulse of Gnawa", source: "Wikimedia Commons", rightsSnapshot: { license: "CC BY-SA 4.0", attribution: "Commons contributor", obligations: ["attribution", "share-alike"], downloadAllowed: true, downloadNotice: "Allowed with attribution." }, graphSnapshot: { path: ["wd:Q1028", "wd:Q1501622", "content:commons-gnawa-pulse"], pathLabels: ["Morocco", "Gnawa", "The living pulse of Gnawa"], matchedTopics: ["Music"], score: 0.94, reason: "Morocco connects to Music." } };
  const saved = toggleSavedItem(createDefaultLocalState(), card);
  assert.equal(saved.saves[0].itemId, card.id);
  assert.equal(saved.saves[0].rightsSnapshot.downloadAllowed, true);
  assert.deepEqual(saved.saves[0].rightsSnapshot.obligations, ["attribution", "share-alike"]);
  assert.deepEqual(saved.saves[0].graphSnapshot.matchedTopics, ["Music"]);
  assert.equal(saved.collections[0].id, "collection:saved");
  const feedback = recordExplicitFeedback(saved, card);
  assert.equal(feedback.feedback[0].signal, "explicit");
  assert.doesNotMatch(JSON.stringify(feedback), /account|login|publish|upload|profile/i);
});

test("history can be cleared without deleting saves or settings", () => {
  const state = toggleSavedItem(recordScrollCreation(createDefaultLocalState(), { interest: "Morocco", topics: ["Music"] }), { id: "item-1", title: "Item", source: "Source" });
  const cleared = clearLocalHistory(state);
  assert.equal(cleared.history.length, 0);
  assert.equal(cleared.saves.length, 1);
});

test("exports are versioned and imports are validated", () => {
  const state = toggleSavedItem(createDefaultLocalState(), { id: "item-1", title: "<script>alert(1)</script>", source: "Source" });
  const exported = buildLocalExport(state, "2026-08-10T00:00:00.000Z");
  assert.equal(exported.product, "OpenScroll");
  assert.equal(exported.kind, "local-browser-backup");
  const imported = parseLocalImport(JSON.stringify(exported));
  assert.equal(imported.saves[0].itemId, "item-1");
  assert.doesNotMatch(imported.saves[0].title, /<script>/i);
  assert.throws(() => parseLocalImport("{"));
  assert.throws(() => parseLocalImport(JSON.stringify({ product: "Other" })));
});

test("serialized exports contain no consumer identity or publishing surface", () => {
  const payload = serializeLocalExport(recordScrollCreation(createDefaultLocalState(), { interest: "Morocco", topics: ["Darija"] }));
  assert.doesNotMatch(payload, /auth|login|account|publish|upload|profile|userId/i);
});

test("quota and private-mode failures return usable status", async () => {
  assert.equal(storageStatusFromError({ name: "QuotaExceededError" }).availability, "quota-exceeded");
  assert.equal(storageStatusFromError({ name: "SecurityError" }).availability, "unavailable");
  const result = await loadLocalData({ indexedDB: null, localStorage: { getItem: () => JSON.stringify({ interest: "Morocco", topics: ["Music"], locale: "es", theme: "dark" }) } });
  assert.equal(result.status.availability, "unavailable");
  assert.equal(result.state.scrolls[0].interest, "Morocco");
  assert.equal(result.state.settings.locale, "es");
});
