#!/usr/bin/env node

import { requestDplaApiKey } from "../packages/content/src/source-api-clients.js";

const email = process.argv[2] || process.env.DPLA_REQUEST_EMAIL || process.env.OPENSCROLL_CONTACT_EMAIL;

if (!email) {
  console.error("Usage: DPLA_REQUEST_EMAIL=you@example.com node scripts/request-dpla-api-key.mjs");
  process.exit(1);
}

try {
  const result = await requestDplaApiKey({ email });
  console.log(result.message);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
