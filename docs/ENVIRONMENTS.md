# Environments

| Environment | Configuration | Deployment rule |
| --- | --- | --- |
| Local | `.env.local`, never committed | Developer machine |
| Test | CI-injected variables | Every pull request |
| Staging | Vercel Preview variables | Preview branch deployment |
| Production | Vercel Production variables | Protected `main` deployment |

OpenScroll topic generation and entity resolution require the server-side `OPENAI_API_KEY` and `OPENAI_MODEL` variables in each environment. Secrets must be stored in the deployment provider, represented by name in `.env.example`, and never prefixed `NEXT_PUBLIC_` unless intentionally public. Database migrations must expose a deterministic `migrate` script before a datastore is introduced.

## Feed Continuation Datastore

Feed continuation sessions (`feed-continuation.v1`) preserve query bindings, search plans, upstream offsets, seen/delivered IDs, and pending accepted overflow between requests:

- **Storage Location**: Configured via `FEED_CONTINUATION_STORE_DIR` (defaults to `.openscroll/feed-sessions` in project root). For test isolation or memory-only environments, `FEED_STORE_TYPE=memory` can be set.
- **Expiry and TTL**: Default session TTL is 1 hour (`3600000` ms), configurable via `FEED_CONTINUATION_TTL_MS`. Expired sessions return HTTP 410 (`CONTINUATION_EXPIRED`) offering the client a seamless restart without discarding saved items.
- **Migration and Pruning**: Run `npm run migrate` (`node scripts/migrate-feed-store.mjs`) to deterministically initialize, verify, and prune the feed continuation store across deployments.
