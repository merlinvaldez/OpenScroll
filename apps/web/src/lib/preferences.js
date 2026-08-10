export const PREFERENCE_KEY = "openscroll:boot-preferences:v1";
export const DEFAULT_PREFERENCES = Object.freeze({ interest: "", topics: ["Music", "Darija", "History"], locale: "en", theme: "system" });
export function parsePreferences(value) {
  if (!value) return { ...DEFAULT_PREFERENCES };
  try {
    const data = JSON.parse(value);
    return {
      interest: typeof data.interest === "string" ? data.interest.slice(0, 120) : "",
      topics: Array.isArray(data.topics) ? data.topics.filter((item) => typeof item === "string").slice(0, 20) : [...DEFAULT_PREFERENCES.topics],
      locale: ["en", "es", "ar"].includes(data.locale) ? data.locale : "en",
      theme: ["system", "light", "dark"].includes(data.theme) ? data.theme : "system"
    };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}
