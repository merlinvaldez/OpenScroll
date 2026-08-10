#!/usr/bin/env node

import { registerOpenverseApplication } from "../packages/content/src/source-api-clients.js";

const email = process.argv[2] || process.env.OPENSCROLL_CONTACT_EMAIL;
const name = process.env.OPENVERSE_APP_NAME || "OpenScroll";
const description = process.env.OPENVERSE_APP_DESCRIPTION || "OpenScroll open cultural feed source integration";

if (!email) {
  console.error("Usage: OPENSCROLL_CONTACT_EMAIL=you@example.com node scripts/register-openverse-app.mjs");
  process.exit(1);
}

try {
  const result = await registerOpenverseApplication({ email, name, description });
  if (!result.clientId || !result.clientSecret) {
    throw new Error("Openverse registration did not return both credentials.");
  }
  console.log(`OPENVERSE_CLIENT_ID=${result.clientId}`);
  console.log(`OPENVERSE_CLIENT_SECRET=${result.clientSecret}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
