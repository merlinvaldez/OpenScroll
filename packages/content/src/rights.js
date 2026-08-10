import { cleanString, deepFreeze, isoDate } from "./utils.js";

export const QUALIFYING_LICENSES = deepFreeze({
  cc0: { label: "CC0 1.0 Universal", url: "https://creativecommons.org/publicdomain/zero/1.0/", obligations: [], shareAlike: false },
  "public-domain": { label: "Public domain", url: "https://creativecommons.org/publicdomain/mark/1.0/", obligations: [], shareAlike: false },
  "public-domain-mark": { label: "Public Domain Mark", url: "https://creativecommons.org/publicdomain/mark/1.0/", obligations: [], shareAlike: false },
  "cc-by-4.0": { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", obligations: ["attribution"], shareAlike: false },
  "cc-by-sa-4.0": { label: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/", obligations: ["attribution", "share-alike"], shareAlike: true },
  "cc-by-3.0": { label: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/", obligations: ["attribution"], shareAlike: false },
  "cc-by-sa-3.0": { label: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/", obligations: ["attribution", "share-alike"], shareAlike: true },
  odbl: { label: "Open Database License", url: "https://opendatacommons.org/licenses/odbl/1-0/", obligations: ["attribution", "share-alike"], shareAlike: true },
  "us-gov-public-domain": { label: "U.S. government public domain", url: "https://www.usa.gov/government-copyright", obligations: [], shareAlike: false }
});

const LICENSE_ALIASES = Object.freeze({
  "cc by 4.0": "cc-by-4.0",
  "cc-by": "cc-by-4.0",
  "cc by-sa 4.0": "cc-by-sa-4.0",
  "cc-by-sa": "cc-by-sa-4.0",
  pdm: "public-domain-mark",
  "public domain mark": "public-domain-mark",
  "public domain": "public-domain",
  "cc zero": "cc0",
  "cc-0": "cc0",
  "cc0 1.0": "cc0",
  "u.s. government public domain": "us-gov-public-domain",
  "us government public domain": "us-gov-public-domain"
});

const CLOSED_LICENSE_PATTERN = /\b(nc|noncommercial|nd|no-derivatives|standard license|all rights reserved|unknown)\b/i;

export function normalizeLicenseId(value) {
  const raw = cleanString(value, 120).toLowerCase();
  return LICENSE_ALIASES[raw] || raw.replace(/creative commons /g, "cc-").replace(/\s+/g, "-");
}

export function evaluateRights(input = {}, context = {}) {
  const licenseId = normalizeLicenseId(input.licenseId || input.license || input.label);
  const license = QUALIFYING_LICENSES[licenseId];
  const sourceVerified = input.sourceVerified === true;
  const rejectedReason = CLOSED_LICENSE_PATTERN.test(`${input.licenseId || ""} ${input.label || ""} ${input.url || ""}`) ? "incompatible-license" : null;
  const eligibility = license && sourceVerified && !rejectedReason ? "eligible" : "rejected";
  return deepFreeze({
    licenseId: licenseId || "unknown",
    label: license?.label || cleanString(input.label || input.license || "Unknown rights", 140),
    url: cleanString(input.url || license?.url || "", 300),
    attribution: cleanString(input.attribution || input.creator || context.sourceName || "", 360),
    verifiedAt: isoDate(input.verifiedAt || context.now),
    verifiedBy: cleanString(input.verifiedBy || "source-metadata", 80),
    eligibility,
    rejectedReason: eligibility === "eligible" ? null : rejectedReason || (sourceVerified ? "unsupported-license" : "unverified-at-source"),
    openUse: {
      access: eligibility === "eligible",
      redistribution: eligibility === "eligible",
      modification: eligibility === "eligible",
      commercialUse: eligibility === "eligible"
    },
    obligations: license?.obligations || [],
    shareAlike: Boolean(license?.shareAlike),
    source: {
      id: cleanString(context.sourceId, 120),
      name: cleanString(context.sourceName, 160),
      url: cleanString(context.sourceUrl || input.sourceUrl, 300)
    }
  });
}

export function isEligibleRights(rights) {
  return rights?.eligibility === "eligible" && rights.openUse?.access && rights.openUse?.redistribution && rights.openUse?.modification && rights.openUse?.commercialUse;
}
