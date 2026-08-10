# Environments

| Environment | Configuration | Deployment rule |
| --- | --- | --- |
| Local | `.env.local`, never committed | Developer machine |
| Test | CI-injected variables | Every pull request |
| Staging | Vercel Preview variables | Preview branch deployment |
| Production | Vercel Production variables | Protected `main` deployment |

Epic A requires no secrets. Future secrets must be stored in the deployment provider, represented by name in `.env.example`, and never prefixed `NEXT_PUBLIC_` unless intentionally public. Database migrations must expose a deterministic `migrate` script before a datastore is introduced.

Epic E introduces API-ready graph reads. The Wikidata client can run with public read endpoints, but production traffic must identify the app:

```env
OPENSCROLL_USER_AGENT="OpenScroll/1.0 (contact: contact@example.com)"
OPENSCROLL_CONTACT_EMAIL="contact@example.com"
```

Source credentials such as `EUROPEANA_API_KEY`, `DPLA_API_KEY`, `SMITHSONIAN_API_KEY`, `DATA_GOV_API_KEY`, `OPENVERSE_CLIENT_ID`, and `OPENVERSE_CLIENT_SECRET` must stay server-side.

Provider-specific setup:

| Source | Env Vars | Notes |
| --- | --- | --- |
| Europeana | `EUROPEANA_API_KEY` | Search API reads include `wskey`, `query`, and `reusability=open`. |
| Smithsonian Open Access | `SMITHSONIAN_API_KEY` or `DATA_GOV_API_KEY` | The Smithsonian Open Access API is backed by api.data.gov keys. |
| DPLA | `DPLA_API_KEY`, optional `DPLA_REQUEST_EMAIL` | The key must be requested with a provider POST before it can be stored. |
| Openverse | `OPENVERSE_CLIENT_ID`, `OPENVERSE_CLIENT_SECRET` | Register first, then use client credentials to request bearer tokens. |

Never expose source credentials through `NEXT_PUBLIC_` variables. Public source reads should happen in server-side ingestion, server actions, or workers, then enter the rights gate before anything appears in a Scroll.
