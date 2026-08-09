# OpenScroll

OpenScroll is a calm, account-free interface for exploring verifiably open knowledge and culture.

This repository currently implements **Epic A (OS-001 through OS-008)**: the engineering foundation, shared contracts, design tokens, icon system, interaction primitives, responsive application shell, accessibility harness, and localization/RTL foundation.

## Workspace

- `apps/web`: Next.js App Router application
- `packages/contracts`: versioned API and event schemas
- `packages/design-tokens`: shared visual and motion tokens
- `docs`: product charter and design specification
- `tests`: browser accessibility tests

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Quality checks

```bash
npm test
npm run lint
npm run build
npm run test:a11y
```

No authentication, database, or runtime secrets are used in Epic A.
