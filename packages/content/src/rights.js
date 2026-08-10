import { cleanString, deepFreeze, isoDate, slug } from "./utils.js";

export const LICENSE_ONTOLOGY_VERSION = "license-ontology.v1";
export const OPEN_LICENSE_GATE_VERSION = "open-license-gate.v1";
export const RIGHTS_REVIEW_VERSION = "rights-review.v1";
export const ATTRIBUTION_VERSION = "attribution.v1";
export const DOWNLOAD_POLICY_VERSION = "rights-safe-download.v1";

function license(record) {
  return deepFreeze({
    status: "qualified-open",
    permits: { access: true, redistribution: true, modification: true, commercialUse: true },
    obligations: [],
    shareAlike: false,
    requiresReview: false,
    rejectionReason: null,
    ...record
  });
}

export const LICENSE_ONTOLOGY = deepFreeze({
  cc0: license({ id: "cc0", label: "CC0 1.0 Universal", family: "creative-commons", url: "https://creativecommons.org/publicdomain/zero/1.0/" }),
  "public-domain": license({ id: "public-domain", label: "Public domain", family: "public-domain", url: "https://creativecommons.org/publicdomain/mark/1.0/" }),
  "public-domain-mark": license({ id: "public-domain-mark", label: "Public Domain Mark", family: "public-domain", url: "https://creativecommons.org/publicdomain/mark/1.0/" }),
  "us-gov-public-domain": license({ id: "us-gov-public-domain", label: "U.S. government public domain", family: "public-domain", url: "https://www.usa.gov/government-copyright" }),
  "cc-by-4.0": license({ id: "cc-by-4.0", label: "CC BY 4.0", family: "creative-commons", url: "https://creativecommons.org/licenses/by/4.0/", obligations: ["attribution"] }),
  "cc-by-sa-4.0": license({ id: "cc-by-sa-4.0", label: "CC BY-SA 4.0", family: "creative-commons", url: "https://creativecommons.org/licenses/by-sa/4.0/", obligations: ["attribution", "share-alike"], shareAlike: true }),
  "cc-by-3.0": license({ id: "cc-by-3.0", label: "CC BY 3.0", family: "creative-commons", url: "https://creativecommons.org/licenses/by/3.0/", obligations: ["attribution"] }),
  "cc-by-sa-3.0": license({ id: "cc-by-sa-3.0", label: "CC BY-SA 3.0", family: "creative-commons", url: "https://creativecommons.org/licenses/by-sa/3.0/", obligations: ["attribution", "share-alike"], shareAlike: true }),
  odbl: license({ id: "odbl", label: "Open Database License", family: "open-data-commons", url: "https://opendatacommons.org/licenses/odbl/1-0/", obligations: ["attribution", "share-alike"], shareAlike: true }),
  "cc-by-nc-4.0": license({ id: "cc-by-nc-4.0", label: "CC BY-NC 4.0", family: "creative-commons", status: "blocked", url: "https://creativecommons.org/licenses/by-nc/4.0/", permits: { access: true, redistribution: true, modification: true, commercialUse: false }, obligations: ["attribution", "noncommercial-only"], rejectionReason: "incompatible-license" }),
  "cc-by-nd-4.0": license({ id: "cc-by-nd-4.0", label: "CC BY-ND 4.0", family: "creative-commons", status: "blocked", url: "https://creativecommons.org/licenses/by-nd/4.0/", permits: { access: true, redistribution: true, modification: false, commercialUse: true }, obligations: ["attribution", "no-derivatives"], rejectionReason: "incompatible-license" }),
  "all-rights-reserved": license({ id: "all-rights-reserved", label: "All rights reserved", family: "restricted", status: "blocked", url: "", permits: { access: false, redistribution: false, modification: false, commercialUse: false }, obligations: [], rejectionReason: "incompatible-license" }),
  unknown: license({ id: "unknown", label: "Unknown rights", family: "unknown", status: "unknown", url: "", permits: { access: false, redistribution: false, modification: false, commercialUse: false }, obligations: [], requiresReview: true, rejectionReason: "unknown-license" })
});

export const QUALIFYING_LICENSES = deepFreeze(Object.fromEntries(Object.entries(LICENSE_ONTOLOGY).filter(([, item]) => item.status === "qualified-open")));

const LICENSE_ALIASES = Object.freeze({
  "cc by 4.0": "cc-by-4.0",
  "cc-by": "cc-by-4.0",
  "cc by": "cc-by-4.0",
  "cc by-sa 4.0": "cc-by-sa-4.0",
  "cc-by-sa": "cc-by-sa-4.0",
  "creative commons attribution-sharealike": "cc-by-sa-4.0",
  "creative commons attribution": "cc-by-4.0",
  pdm: "public-domain-mark",
  "public domain mark": "public-domain-mark",
  "public domain": "public-domain",
  "cc zero": "cc0",
  "cc-0": "cc0",
  "cc0 1.0": "cc0",
  "u.s. government public domain": "us-gov-public-domain",
  "us government public domain": "us-gov-public-domain",
  "cc by-nc 4.0": "cc-by-nc-4.0",
  "cc-by-nc": "cc-by-nc-4.0",
  "cc by-nd 4.0": "cc-by-nd-4.0",
  "cc-by-nd": "cc-by-nd-4.0",
  copyright: "all-rights-reserved",
  "standard license": "all-rights-reserved",
  "all rights reserved": "all-rights-reserved"
});

const URL_LICENSE_PATTERNS = Object.freeze([
  [/creativecommons\.org\/publicdomain\/zero\/1\.0/i, "cc0"],
  [/creativecommons\.org\/publicdomain\/mark\/1\.0/i, "public-domain-mark"],
  [/creativecommons\.org\/licenses\/by-sa\/4\.0/i, "cc-by-sa-4.0"],
  [/creativecommons\.org\/licenses\/by\/4\.0/i, "cc-by-4.0"],
  [/creativecommons\.org\/licenses\/by-sa\/3\.0/i, "cc-by-sa-3.0"],
  [/creativecommons\.org\/licenses\/by\/3\.0/i, "cc-by-3.0"],
  [/creativecommons\.org\/licenses\/by-nc\/4\.0/i, "cc-by-nc-4.0"],
  [/creativecommons\.org\/licenses\/by-nd\/4\.0/i, "cc-by-nd-4.0"],
  [/opendatacommons\.org\/licenses\/odbl\/1-0/i, "odbl"]
]);

function normalizeLicenseToken(value) {
  return cleanString(value, 180)
    .toLowerCase()
    .replace(/creative commons /g, "cc ")
    .replace(/\+/g, " ")
    .replace(/_/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLicenseId(value) {
  const raw = cleanString(value, 300);
  for (const [pattern, licenseId] of URL_LICENSE_PATTERNS) if (pattern.test(raw)) return licenseId;
  const normalized = normalizeLicenseToken(raw);
  if (!normalized) return "unknown";
  if (LICENSE_ALIASES[normalized]) return LICENSE_ALIASES[normalized];
  const hyphenated = normalized.replace(/\s+/g, "-");
  return LICENSE_ONTOLOGY[hyphenated] ? hyphenated : hyphenated || "unknown";
}

export function getLicenseRecord(value) {
  return LICENSE_ONTOLOGY[normalizeLicenseId(value)] || LICENSE_ONTOLOGY.unknown;
}

export function verifySourceRights(input = {}, context = {}) {
  const sourceUrl = cleanString(input.sourceUrl || context.sourceUrl, 300);
  const originalSourceUrl = cleanString(input.originalSourceUrl || context.originalSourceUrl || sourceUrl, 300);
  const evidenceUrl = cleanString(input.evidenceUrl || originalSourceUrl || sourceUrl, 300);
  const sourceVerified = input.sourceVerified === true;
  const status = sourceVerified ? "verified" : input.sourceVerified === "needs-review" || evidenceUrl ? "needs-review" : "failed";
  return deepFreeze({
    status,
    sourceVerified,
    checkedAt: isoDate(input.verifiedAt || context.now),
    checkedBy: cleanString(input.verifiedBy || "source-metadata", 80),
    sourceId: cleanString(context.sourceId || input.sourceId, 120),
    sourceName: cleanString(context.sourceName || input.sourceName, 160),
    sourceUrl,
    originalSourceUrl,
    evidenceUrl,
    evidence: cleanString(input.evidence || (sourceVerified ? "License found on the source record." : "Source license needs manual confirmation."), 220)
  });
}

function rightsReasons(licenseRecord, verification, input = {}) {
  const reasons = [];
  if (licenseRecord.status === "unknown") reasons.push("unknown-license");
  if (licenseRecord.status === "blocked") reasons.push(licenseRecord.rejectionReason || "incompatible-license");
  if (verification.status === "failed") reasons.push("unverified-at-source");
  if (verification.status === "needs-review") reasons.push("source-verification-review");
  if (input.reviewRequired === true) reasons.push(cleanString(input.reviewReason || "manual-review-required", 120));
  return [...new Set(reasons)];
}

function eligibilityFor(licenseRecord, verification, reasons) {
  if (licenseRecord.status === "qualified-open" && verification.status === "verified" && reasons.length === 0) return "eligible";
  if (reasons.includes("incompatible-license")) return "rejected";
  return "review";
}

export function createAttributionNotice(input = {}, context = {}) {
  const licenseRecord = getLicenseRecord(input.licenseId || input.license || input.label);
  const title = cleanString(context.title || input.title, 180);
  const creator = cleanString(input.attribution || input.creator || context.creatorNames?.join(", ") || context.sourceName, 360);
  const sourceName = cleanString(context.sourceName || input.sourceName, 160);
  const sourceUrl = cleanString(context.sourceUrl || input.sourceUrl, 300);
  const licenseLabel = licenseRecord.label;
  const licenseUrl = cleanString(input.url || licenseRecord.url, 300);
  const parts = [
    title ? `"${title}"` : "",
    creator ? `by ${creator}` : "",
    sourceName ? `via ${sourceName}` : "",
    licenseLabel ? `licensed ${licenseLabel}` : "",
    sourceUrl ? `source ${sourceUrl}` : ""
  ].filter(Boolean);
  return deepFreeze({
    schemaVersion: ATTRIBUTION_VERSION,
    required: licenseRecord.obligations.includes("attribution"),
    text: parts.join(", "),
    markdown: [title ? `**${title}**` : "", creator ? `by ${creator}` : "", sourceName ? `via ${sourceName}` : "", licenseLabel ? `[${licenseLabel}](${licenseUrl || sourceUrl})` : ""].filter(Boolean).join(" "),
    parts: { title, creator, sourceName, sourceUrl, licenseLabel, licenseUrl },
    obligations: licenseRecord.obligations,
    shareAlike: licenseRecord.shareAlike
  });
}

export function createWhyOpenExplanation(rights) {
  const obligations = rights.obligations.length ? `Requires ${rights.obligations.join(" and ")}.` : "No reuse obligations detected.";
  const bullets = rights.eligibility === "eligible"
    ? [
        `${rights.label} is in the normalized open-license ontology.`,
        `The item was verified at its original source${rights.verification.originalSourceUrl ? `: ${rights.verification.originalSourceUrl}` : "."}`,
        "The license allows access, redistribution, modification, and commercial use.",
        obligations
      ]
    : [
        rights.rejectedReason === "incompatible-license" ? "The license includes a restriction OpenScroll does not accept." : "The item is not source-verified enough for the main Scroll.",
        "OpenScroll fails closed until the item has a qualified open license and source evidence."
      ];
  return deepFreeze({
    headline: rights.eligibility === "eligible" ? "Verified open for OpenScroll" : rights.eligibility === "review" ? "Needs rights review" : "Not eligible for OpenScroll",
    bullets,
    basis: rights.eligibility === "eligible" ? "qualified-open-license-and-source-verification" : rights.rejectedReason
  });
}

export function createRightsSafeDownloadPolicy(rights, context = {}) {
  const allowed = rights.eligibility === "eligible" && rights.openUse.redistribution === true;
  const mediaUrl = cleanString(context.mediaUrl || rights.verification.originalSourceUrl || rights.source.url, 300);
  const metadataUrl = cleanString(context.metadataUrl || rights.source.url, 300);
  return deepFreeze({
    schemaVersion: DOWNLOAD_POLICY_VERSION,
    allowed,
    access: allowed ? "source-file-and-metadata" : "blocked",
    reason: allowed ? "qualified-open-license" : rights.rejectedReason || "not-eligible",
    requiresAttribution: rights.obligations.includes("attribution"),
    shareAlike: rights.shareAlike,
    obligations: rights.obligations,
    files: {
      media: allowed && Boolean(mediaUrl),
      metadata: allowed && Boolean(metadataUrl),
      mediaUrl,
      metadataUrl
    },
    notice: allowed ? `Allowed with ${rights.label}${rights.obligations.length ? `; ${rights.obligations.join(", ")}` : ""}.` : "Download blocked until rights are verified open."
  });
}

export function evaluateRights(input = {}, context = {}) {
  const licenseId = normalizeLicenseId(input.licenseId || input.license || input.label || input.url);
  const licenseRecord = getLicenseRecord(licenseId);
  const verification = verifySourceRights(input, context);
  const reasons = rightsReasons(licenseRecord, verification, input);
  const eligibility = eligibilityFor(licenseRecord, verification, reasons);
  const attributionNotice = createAttributionNotice({ ...input, licenseId }, context);
  const rights = {
    schemaVersion: "rights.v1",
    ontologyVersion: LICENSE_ONTOLOGY_VERSION,
    licenseId,
    label: licenseRecord.label,
    url: cleanString(input.url || licenseRecord.url, 300),
    attribution: attributionNotice.text,
    attributionNotice,
    verifiedAt: verification.checkedAt,
    verifiedBy: verification.checkedBy,
    verification,
    eligibility,
    rejectedReason: eligibility === "eligible" ? null : reasons[0] || licenseRecord.rejectionReason || "requires-review",
    reviewRequired: eligibility === "review",
    openUse: {
      access: eligibility === "eligible" && licenseRecord.permits.access,
      redistribution: eligibility === "eligible" && licenseRecord.permits.redistribution,
      modification: eligibility === "eligible" && licenseRecord.permits.modification,
      commercialUse: eligibility === "eligible" && licenseRecord.permits.commercialUse
    },
    obligations: licenseRecord.obligations,
    shareAlike: Boolean(licenseRecord.shareAlike),
    source: {
      id: cleanString(context.sourceId || input.sourceId, 120),
      name: cleanString(context.sourceName || input.sourceName, 160),
      url: cleanString(context.sourceUrl || input.sourceUrl, 300)
    }
  };
  rights.whyOpen = createWhyOpenExplanation(rights);
  rights.downloadPolicy = createRightsSafeDownloadPolicy(rights, context);
  rights.gate = createOpenLicenseGateDecision(rights, context);
  return deepFreeze(rights);
}

export function createOpenLicenseGateDecision(rights, context = {}) {
  const decision = rights.eligibility === "eligible" ? "accept" : rights.eligibility === "review" ? "review" : "reject";
  return deepFreeze({
    schemaVersion: OPEN_LICENSE_GATE_VERSION,
    decision,
    canEnterScroll: decision === "accept",
    canDownload: decision === "accept" && rights.downloadPolicy?.allowed === true,
    itemId: cleanString(context.itemId, 160),
    sourceId: cleanString(rights.source?.id || context.sourceId, 120),
    licenseId: rights.licenseId,
    reason: decision === "accept" ? "qualified-open-license" : rights.rejectedReason,
    reasons: rights.rejectedReason ? [rights.rejectedReason] : [],
    checkedAt: rights.verifiedAt
  });
}

export function openLicenseGate(input = {}, context = {}) {
  const rights = evaluateRights(input, context);
  return deepFreeze({ ...rights.gate, rights });
}

export function createRightsReviewCase(record = {}, decision = {}, context = {}) {
  const itemKey = cleanString(record.sourceItemId || record.id || decision.itemId, 180);
  const sourceId = cleanString(record.sourceId || decision.sourceId || context.sourceId, 120);
  const reason = cleanString(decision.reason || "requires-review", 120);
  return deepFreeze({
    schemaVersion: RIGHTS_REVIEW_VERSION,
    id: `rights-review:${slug(sourceId, "source")}:${slug(itemKey, "item")}`,
    itemId: itemKey,
    sourceId,
    status: "queued",
    priority: reason === "unknown-license" || reason === "source-verification-review" ? "high" : "normal",
    reason,
    title: cleanString(record.title, 180),
    sourceUrl: cleanString(record.sourceUrl, 300),
    originalSourceUrl: cleanString(record.originalSourceUrl || record.sourceUrl, 300),
    licenseId: cleanString(decision.licenseId || record.rights?.licenseId || record.rights?.license, 120),
    summary: cleanString(`Confirm ${reason.replace(/-/g, " ")} before this item can enter the main Scroll.`, 240),
    createdAt: isoDate(context.now),
    assignedTo: "rights-review"
  });
}

export function isEligibleRights(rights) {
  return rights?.eligibility === "eligible" && rights.openUse?.access && rights.openUse?.redistribution && rights.openUse?.modification && rights.openUse?.commercialUse;
}
