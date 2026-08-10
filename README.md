# OpenScroll

OpenScroll is a calm, account-free interface for exploring verifiably open knowledge and culture.

Epic A (OS-001 through OS-008) is implemented as the production foundation, including the monorepo, versioned contracts, compatibility gate, design tokens, icon and interaction primitives, responsive mobile/tablet/desktop shells, accessibility harness, and English/Spanish/Arabic localization with RTL support.

Epic B (OS-009 through OS-012) implements the no-auth local-first layer: versioned IndexedDB storage, browser-local Scroll continuity, local saves and explicit feedback, settings and storage controls, export/import, history clearing, full local reset, and fallback behavior for limited browser storage modes.

## Commands

```bash
npm install
npm run dev
npm run check
npm run test:a11y
```

Environment separation is documented in `docs/ENVIRONMENTS.md`; manual accessibility verification is in `docs/ACCESSIBILITY_TEST_PLAN.md`.
