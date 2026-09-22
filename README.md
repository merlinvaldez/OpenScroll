# OpenScroll

OpenScroll is a calm, account-free interface for exploring verifiably open knowledge and culture.

Epic A (OS-001 through OS-008) is implemented as the production foundation, including the monorepo, versioned contracts, compatibility gate, design tokens, icon and interaction primitives, responsive mobile/tablet/desktop shells, accessibility harness, and English/Spanish/Arabic localization with RTL support.

Epic B (OS-009 through OS-012) implements the no-auth local-first layer: versioned IndexedDB storage, browser-local Scroll continuity, local saves and explicit feedback, settings and storage controls, export/import, history clearing, full local reset, and fallback behavior for limited browser storage modes.

Epic C (OS-013 through OS-020) implements the source and content platform foundation: Universal Content Objects, Source Registry governance, connector SDK conformance, ingestion orchestration, and verified-open fixture connectors for Wikimedia knowledge projects, Wikimedia Commons, Openverse, Smithsonian Open Access, Europeana, and DPLA.

Epic D (OS-021 through OS-027) implements the rights foundation: normalized license ontology, Open License Gate, item-level source verification, rights-review queue, attribution engine, "Why open?" details, and rights-safe download policy.

## Commands

```bash
npm install
npm run dev
npm run check
npm run test:a11y
```

Environment separation is documented in `docs/ENVIRONMENTS.md`; manual accessibility verification is in `docs/ACCESSIBILITY_TEST_PLAN.md`.

Topic expansion and entity resolution use OpenAI exclusively. OpenAI generates both the query-specific category taxonomy and the topics inside each category; the app no longer supplies a static category list. Live feed candidate relevance is evaluated by Jev through Vercel AI Gateway using `typesafe-ai/jev`; it has no OpenAI fallback. Set `OPENAI_API_KEY` and `OPENAI_MODEL` for topic/entity features, and `AI_GATEWAY_API_KEY` or Vercel OIDC for Jev feed evaluation.
