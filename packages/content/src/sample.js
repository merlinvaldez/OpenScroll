import { createUniversalContentObject } from "./content-object.js";
import { EPIC_C_RAW_ITEMS } from "./fixtures.js";
import { openLicenseGate } from "./rights.js";
import { getSource } from "./source-registry.js";

export const canonicalMoroccoSample = EPIC_C_RAW_ITEMS
  .filter((record) => {
    const source = getSource(record.sourceId);
    return openLicenseGate(record.rights, { sourceId: source?.id, sourceName: source?.name, sourceUrl: record.sourceUrl, originalSourceUrl: record.originalSourceUrl || record.sourceUrl }).decision === "accept";
  })
  .map((record) => createUniversalContentObject(record));
