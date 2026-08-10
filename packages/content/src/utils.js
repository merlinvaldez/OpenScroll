export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function cleanString(value, maxLength = 240) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, maxLength) : "";
}

export function slug(value, fallback = "item") {
  return cleanString(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

export function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

export function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function isoDate(value, fallback = "2026-08-10T00:00:00.000Z") {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

export function numberBetween(value, min = 0, max = 1, fallback = 0) {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}
