# OpenScroll

OpenScroll is a calm, account-free interface for exploring knowledge and culture with source links and creator information.

Epic A (OS-001 through OS-008) is implemented as the production foundation, including the monorepo, versioned contracts, compatibility gate, design tokens, icon and interaction primitives, responsive mobile/tablet/desktop shells, accessibility harness, and English/Spanish/Arabic localization with RTL support.

Epic B (OS-009 through OS-012) implements the no-auth local-first layer: versioned IndexedDB storage, browser-local Scroll continuity, local saves and explicit feedback, settings and storage controls, export/import, history clearing, full local reset, and fallback behavior for limited browser storage modes.

Epic C (OS-013 through OS-020) implements the source and content platform foundation: Universal Content Objects, Source Registry governance, connector SDK conformance, ingestion orchestration, and fixture connectors for Wikimedia knowledge projects, Wikimedia Commons, Openverse, Smithsonian Open Access, Europeana, and DPLA.

The former Epic D licensing foundation is superseded. Step 2 of [the feed implementation plan](specs/feed-speed-accuracy-decisions-api.md) removes licensing eligibility, review queues, and rights passports from backend contracts. Active UCO, source registry, connector, and ingestion contracts are v2. Saved-data storage and exports use v2 and import v1 backups; IDs, collections, existing source links, playback metadata, and explicit feedback survive migration. Historical v1 schemas remain available only to the compatibility audit in `packages/contracts/src/legacy-schemas.js`, not through package exports. The broader UI/wording cleanup remains scheduled in Step 8.

## Commands

```bash
npm install
npm run dev
npm run check
npm run test:a11y
```

Environment separation is documented in `docs/ENVIRONMENTS.md`; manual accessibility verification is in `docs/ACCESSIBILITY_TEST_PLAN.md`.

Feed measurements, captured baseline evidence, numerical release targets, and repeatable benchmark commands are in [benchmarks/feed/README.md](benchmarks/feed/README.md). Set server-side `FEED_METRICS_LOG=1` to log aggregate request diagnostics without search text or credentials.

Topic expansion and entity resolution use OpenAI exclusively. OpenAI generates both the query-specific category taxonomy and the topics inside each category; the app no longer supplies a static category list. Set `OPENAI_API_KEY` and `OPENAI_MODEL` in the local environment; there is no local, Wikipedia, or curated fallback when OpenAI fails.
