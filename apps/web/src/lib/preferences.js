export const PREFERENCE_KEY = "openscroll:boot-preferences:v1";
export const LOCAL_DB_NAME = "openscroll-local";
export const LOCAL_DB_VERSION = 1;
export const LOCAL_EXPORT_VERSION = 1;

export const STORE_NAMES = Object.freeze(["meta", "settings", "scrolls", "saves", "collections", "feedback", "history"]);
export const DEFAULT_TOPICS = Object.freeze(["Music", "Darija", "History"]);
export const DEFAULT_PREFERENCES = Object.freeze({ interest: "", topics: DEFAULT_TOPICS, locale: "en", theme: "system" });
export const DEFAULT_SETTINGS = Object.freeze({
  locale: "en",
  theme: "system",
  media: Object.freeze({ images: true, audio: true, video: true, text: true, data: true }),
  sources: Object.freeze({ wikimedia: true, openverse: true, smithsonian: true, europeana: true, dpla: true }),
  accessibility: Object.freeze({ reducedMotion: false, largeText: false }),
  privacy: Object.freeze({ saveHistory: true, explicitSignalsOnly: true, retentionDays: 90, telemetry: "minimal" })
});

const SUPPORTED_LOCALES = new Set(["en", "es", "ar"]);
const SUPPORTED_THEMES = new Set(["system", "light", "dark"]);
const SOURCE_KEYS = Object.keys(DEFAULT_SETTINGS.sources);
const MEDIA_KEYS = Object.keys(DEFAULT_SETTINGS.media);

function nowIso() {
  return new Date().toISOString();
}

function defaultPreferences() {
  return { ...DEFAULT_PREFERENCES, topics: [...DEFAULT_TOPICS] };
}

function cleanString(value, maxLength = 160) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, maxLength) : "";
}

function cleanDate(value, fallback = nowIso()) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function cleanTopics(value) {
  const topics = Array.isArray(value) ? value : DEFAULT_TOPICS;
  const seen = new Set();
  return topics.map((item) => cleanString(item, 64)).filter((item) => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  }).slice(0, 20);
}

function cleanBooleanMap(input, defaults, keys) {
  return keys.reduce((result, key) => ({ ...result, [key]: typeof input?.[key] === "boolean" ? input[key] : defaults[key] }), {});
}

function cleanSettings(input = {}) {
  const locale = SUPPORTED_LOCALES.has(input.locale) ? input.locale : DEFAULT_SETTINGS.locale;
  const theme = SUPPORTED_THEMES.has(input.theme) ? input.theme : DEFAULT_SETTINGS.theme;
  const retentionDays = Number.isInteger(input.privacy?.retentionDays) ? Math.min(Math.max(input.privacy.retentionDays, 1), 365) : DEFAULT_SETTINGS.privacy.retentionDays;
  return {
    locale,
    theme,
    media: cleanBooleanMap(input.media, DEFAULT_SETTINGS.media, MEDIA_KEYS),
    sources: cleanBooleanMap(input.sources, DEFAULT_SETTINGS.sources, SOURCE_KEYS),
    accessibility: {
      reducedMotion: typeof input.accessibility?.reducedMotion === "boolean" ? input.accessibility.reducedMotion : DEFAULT_SETTINGS.accessibility.reducedMotion,
      largeText: typeof input.accessibility?.largeText === "boolean" ? input.accessibility.largeText : DEFAULT_SETTINGS.accessibility.largeText
    },
    privacy: {
      saveHistory: typeof input.privacy?.saveHistory === "boolean" ? input.privacy.saveHistory : DEFAULT_SETTINGS.privacy.saveHistory,
      explicitSignalsOnly: true,
      retentionDays,
      telemetry: "minimal"
    }
  };
}

function slug(value) {
  return cleanString(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "local";
}

function recordId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanRecordId(value, prefix) {
  const cleaned = cleanString(value, 96).replace(/[^a-zA-Z0-9:_-]/g, "");
  return cleaned || recordId(prefix);
}

function cleanRecords(value, cleaner, limit = 200) {
  return (Array.isArray(value) ? value : []).map(cleaner).filter(Boolean).slice(0, limit);
}

function cleanScroll(record) {
  const interest = cleanString(record?.interest, 120);
  if (!interest) return null;
  const timestamp = cleanDate(record?.updatedAt || record?.createdAt);
  return {
    id: cleanRecordId(record?.id || `scroll:${slug(interest)}`, "scroll"),
    interest,
    topics: cleanTopics(record?.topics),
    createdAt: cleanDate(record?.createdAt, timestamp),
    updatedAt: timestamp,
    itemCount: Number.isInteger(record?.itemCount) ? Math.min(Math.max(record.itemCount, 0), 1000) : 0,
    source: "local"
  };
}

function cleanCollection(record) {
  const name = cleanString(record?.name, 80);
  if (!name) return null;
  const timestamp = cleanDate(record?.updatedAt || record?.createdAt);
  return {
    id: cleanRecordId(record?.id || `collection:${slug(name)}`, "collection"),
    name,
    createdAt: cleanDate(record?.createdAt, timestamp),
    updatedAt: timestamp
  };
}

function cleanSave(record) {
  const itemId = cleanString(record?.itemId, 96);
  if (!itemId) return null;
  return {
    id: cleanRecordId(record?.id || `save:${itemId}`, "save"),
    itemId,
    title: cleanString(record?.title, 160),
    source: cleanString(record?.source, 120),
    savedAt: cleanDate(record?.savedAt),
    collectionIds: cleanRecords(record?.collectionIds, (item) => cleanString(item, 96), 20),
    rightsSnapshot: {
      basis: cleanString(record?.rightsSnapshot?.basis || "verified-open-source-item", 80),
      source: cleanString(record?.rightsSnapshot?.source || record?.source, 120),
      license: cleanString(record?.rightsSnapshot?.license, 120)
    }
  };
}

function cleanFeedback(record) {
  const itemId = cleanString(record?.itemId, 96);
  const action = cleanString(record?.action, 80);
  if (!itemId || !action) return null;
  return {
    id: cleanRecordId(record?.id, "feedback"),
    itemId,
    action,
    signal: "explicit",
    createdAt: cleanDate(record?.createdAt)
  };
}

function cleanHistory(record) {
  const type = cleanString(record?.type, 80);
  if (!type) return null;
  return {
    id: cleanRecordId(record?.id, "history"),
    type,
    signal: "implicit",
    targetId: cleanString(record?.targetId, 120),
    label: cleanString(record?.label, 160),
    createdAt: cleanDate(record?.createdAt)
  };
}

export function parsePreferences(value) {
  if (!value) return defaultPreferences();
  try {
    const data = JSON.parse(value);
    return {
      interest: cleanString(data.interest, 120),
      topics: cleanTopics(data.topics),
      locale: SUPPORTED_LOCALES.has(data.locale) ? data.locale : DEFAULT_PREFERENCES.locale,
      theme: SUPPORTED_THEMES.has(data.theme) ? data.theme : DEFAULT_PREFERENCES.theme
    };
  } catch {
    return defaultPreferences();
  }
}

export function createDefaultLocalState(timestamp = nowIso()) {
  return { schemaVersion: LOCAL_DB_VERSION, updatedAt: timestamp, settings: cleanSettings(DEFAULT_SETTINGS), scrolls: [], saves: [], collections: [], feedback: [], history: [] };
}

export function normalizeLocalState(input = {}, timestamp = nowIso()) {
  const defaults = createDefaultLocalState(timestamp);
  return {
    schemaVersion: LOCAL_DB_VERSION,
    updatedAt: cleanDate(input.updatedAt, timestamp),
    settings: cleanSettings({ ...defaults.settings, ...input.settings, privacy: { ...defaults.settings.privacy, ...input.settings?.privacy } }),
    scrolls: cleanRecords(input.scrolls, cleanScroll, 50),
    saves: cleanRecords(input.saves, cleanSave, 500),
    collections: cleanRecords(input.collections, cleanCollection, 100),
    feedback: cleanRecords(input.feedback, cleanFeedback, 500),
    history: cleanRecords(input.history, cleanHistory, 200)
  };
}

export function localStateFromPreferences(preferences = defaultPreferences()) {
  const timestamp = nowIso();
  const interest = cleanString(preferences.interest, 120);
  return normalizeLocalState({
    updatedAt: timestamp,
    settings: { locale: preferences.locale, theme: preferences.theme },
    scrolls: interest ? [{ id: `scroll:${slug(interest)}`, interest, topics: preferences.topics, createdAt: timestamp, updatedAt: timestamp, source: "local" }] : []
  }, timestamp);
}

export function preferencesFromState(state) {
  const localState = normalizeLocalState(state);
  const latestScroll = localState.scrolls[0];
  return {
    interest: latestScroll?.interest || "",
    topics: latestScroll?.topics?.length ? latestScroll.topics : [...DEFAULT_TOPICS],
    locale: localState.settings.locale,
    theme: localState.settings.theme
  };
}

export function updateLocalSettings(state, patch) {
  const timestamp = nowIso();
  const localState = normalizeLocalState(state, timestamp);
  return normalizeLocalState({
    ...localState,
    updatedAt: timestamp,
    settings: {
      ...localState.settings,
      ...patch,
      media: { ...localState.settings.media, ...patch.media },
      sources: { ...localState.settings.sources, ...patch.sources },
      accessibility: { ...localState.settings.accessibility, ...patch.accessibility },
      privacy: { ...localState.settings.privacy, ...patch.privacy }
    }
  }, timestamp);
}

export function recordScrollCreation(state, { interest, topics }) {
  const timestamp = nowIso();
  const localState = normalizeLocalState(state, timestamp);
  const cleanInterest = cleanString(interest, 120);
  if (!cleanInterest) return localState;
  const cleanTopicList = cleanTopics(topics);
  const scroll = {
    id: `scroll:${slug(cleanInterest)}:${cleanTopicList.map(slug).join(":")}`,
    interest: cleanInterest,
    topics: cleanTopicList,
    createdAt: timestamp,
    updatedAt: timestamp,
    itemCount: 0,
    source: "local"
  };
  const history = localState.settings.privacy.saveHistory ? [{ id: recordId("history"), type: "scroll-created", signal: "implicit", targetId: scroll.id, label: cleanInterest, createdAt: timestamp }, ...localState.history] : localState.history;
  return normalizeLocalState({ ...localState, updatedAt: timestamp, scrolls: [scroll, ...localState.scrolls.filter((item) => item.id !== scroll.id)], history }, timestamp);
}

export function toggleSavedItem(state, item) {
  const timestamp = nowIso();
  const localState = normalizeLocalState(state, timestamp);
  const itemId = cleanString(item?.id, 96);
  if (!itemId) return localState;
  const saveId = `save:${itemId}`;
  const alreadySaved = localState.saves.some((save) => save.id === saveId);
  if (alreadySaved) return normalizeLocalState({ ...localState, updatedAt: timestamp, saves: localState.saves.filter((save) => save.id !== saveId) }, timestamp);
  const collection = localState.collections.find((entry) => entry.id === "collection:saved") || { id: "collection:saved", name: "Saved", createdAt: timestamp, updatedAt: timestamp };
  return normalizeLocalState({
    ...localState,
    updatedAt: timestamp,
    collections: [collection, ...localState.collections.filter((entry) => entry.id !== collection.id)],
    saves: [{
      id: saveId,
      itemId,
      title: item.title,
      source: item.source,
      savedAt: timestamp,
      collectionIds: [collection.id],
      rightsSnapshot: {
        basis: cleanString(item.rightsSnapshot?.basis || "verified-open-source-item", 80),
        source: cleanString(item.rightsSnapshot?.source || item.source, 120),
        license: cleanString(item.rightsSnapshot?.license, 120)
      }
    }, ...localState.saves]
  }, timestamp);
}

export function recordExplicitFeedback(state, item, action = "more-like-this") {
  const timestamp = nowIso();
  const localState = normalizeLocalState(state, timestamp);
  const itemId = cleanString(item?.id || item?.itemId, 96);
  if (!itemId) return localState;
  return normalizeLocalState({ ...localState, updatedAt: timestamp, feedback: [{ id: recordId("feedback"), itemId, action, signal: "explicit", createdAt: timestamp }, ...localState.feedback] }, timestamp);
}

export function clearLocalHistory(state) {
  return normalizeLocalState({ ...normalizeLocalState(state), updatedAt: nowIso(), history: [] });
}

export function resetLocalState() {
  return createDefaultLocalState();
}

export function storageStatusFromError(error) {
  const name = error?.name || "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return { availability: "quota-exceeded", message: "Browser storage is full." };
  if (name === "InvalidStateError" || name === "AbortError" || name === "SecurityError") return { availability: "unavailable", message: "Local storage is unavailable in this browser mode." };
  return { availability: "unavailable", message: "Local storage could not be opened." };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function openLocalDatabase(indexedDBRef = globalThis.indexedDB) {
  if (!indexedDBRef) return Promise.reject(Object.assign(new Error("IndexedDB unavailable"), { name: "InvalidStateError" }));
  return new Promise((resolve, reject) => {
    const request = indexedDBRef.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORE_NAMES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: store === "meta" || store === "settings" ? "key" : "id" });
      }
      request.transaction.objectStore("meta").put({ key: "schema", version: LOCAL_DB_VERSION, migratedAt: nowIso() });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Object.assign(new Error("IndexedDB blocked"), { name: "InvalidStateError" }));
  });
}

async function readStore(transaction, name) {
  return requestToPromise(transaction.objectStore(name).getAll());
}

async function writeStore(transaction, name, records) {
  const store = transaction.objectStore(name);
  store.clear();
  for (const record of records) store.put(record);
}

async function readDatabaseState(db) {
  const transaction = db.transaction(STORE_NAMES, "readonly");
  const [settingsRows, scrolls, saves, collections, feedback, history] = await Promise.all([
    readStore(transaction, "settings"),
    readStore(transaction, "scrolls"),
    readStore(transaction, "saves"),
    readStore(transaction, "collections"),
    readStore(transaction, "feedback"),
    readStore(transaction, "history")
  ]);
  return {
    hasSettings: settingsRows.some((row) => row.key === "settings"),
    state: normalizeLocalState({ settings: settingsRows.find((row) => row.key === "settings")?.value, scrolls, saves, collections, feedback, history })
  };
}

async function writeDatabaseState(db, state) {
  const localState = normalizeLocalState(state);
  const transaction = db.transaction(STORE_NAMES, "readwrite");
  writeStore(transaction, "settings", [{ key: "settings", value: localState.settings }]);
  writeStore(transaction, "scrolls", localState.scrolls);
  writeStore(transaction, "saves", localState.saves);
  writeStore(transaction, "collections", localState.collections);
  writeStore(transaction, "feedback", localState.feedback);
  writeStore(transaction, "history", localState.history);
  transaction.objectStore("meta").put({ key: "schema", version: LOCAL_DB_VERSION, updatedAt: localState.updatedAt });
  await transactionDone(transaction);
  return localState;
}

function readBootPreferences(localStorageRef = globalThis.localStorage) {
  try {
    return parsePreferences(localStorageRef?.getItem(PREFERENCE_KEY));
  } catch {
    return defaultPreferences();
  }
}

function writeBootPreferences(state, localStorageRef = globalThis.localStorage) {
  try {
    localStorageRef?.setItem(PREFERENCE_KEY, JSON.stringify(preferencesFromState(state)));
  } catch {
    return false;
  }
  return true;
}

export async function loadLocalData(options = {}) {
  const bootState = localStateFromPreferences(readBootPreferences(options.localStorage));
  try {
    const db = await openLocalDatabase(options.indexedDB);
    const stored = await readDatabaseState(db);
    db.close?.();
    const state = normalizeLocalState({
      ...stored.state,
      settings: stored.hasSettings ? stored.state.settings : bootState.settings,
      scrolls: stored.state.scrolls.length ? stored.state.scrolls : bootState.scrolls
    });
    return { state, status: { availability: "ready", message: "Saved on this device." } };
  } catch (error) {
    return { state: bootState, status: storageStatusFromError(error) };
  }
}

export async function saveLocalData(state, options = {}) {
  const localState = normalizeLocalState(state);
  writeBootPreferences(localState, options.localStorage);
  try {
    const db = await openLocalDatabase(options.indexedDB);
    const savedState = await writeDatabaseState(db, localState);
    db.close?.();
    return { state: savedState, status: { availability: "ready", message: "Saved on this device." } };
  } catch (error) {
    return { state: localState, status: storageStatusFromError(error) };
  }
}

export async function getDeviceStorageStatus(storageRef = globalThis.navigator?.storage) {
  const status = { persisted: false, usage: null, quota: null, percent: null };
  if (!storageRef) return status;
  try {
    const [estimate, persisted] = await Promise.all([storageRef.estimate?.(), storageRef.persisted?.()]);
    const usage = Number.isFinite(estimate?.usage) ? estimate.usage : null;
    const quota = Number.isFinite(estimate?.quota) ? estimate.quota : null;
    return { persisted: Boolean(persisted), usage, quota, percent: usage !== null && quota ? Math.round((usage / quota) * 100) : null };
  } catch {
    return status;
  }
}

export async function requestLocalPersistence(storageRef = globalThis.navigator?.storage) {
  try {
    return Boolean(await storageRef?.persist?.());
  } catch {
    return false;
  }
}

export function buildLocalExport(state, exportedAt = nowIso()) {
  return { product: "OpenScroll", kind: "local-browser-backup", schemaVersion: LOCAL_EXPORT_VERSION, exportedAt, data: normalizeLocalState(state, exportedAt) };
}

export function serializeLocalExport(state) {
  return JSON.stringify(buildLocalExport(state), null, 2);
}

export function parseLocalImport(value) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    throw Object.assign(new Error("Import file is not valid JSON."), { cause: error });
  }
  if (parsed?.product !== "OpenScroll" || parsed?.kind !== "local-browser-backup" || parsed?.schemaVersion !== LOCAL_EXPORT_VERSION) {
    throw new Error("Import file is not an OpenScroll local backup.");
  }
  return normalizeLocalState(parsed.data);
}
