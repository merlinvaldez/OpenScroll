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

Future source credentials such as `EUROPEANA_API_KEY`, `DPLA_API_KEY`, `SMITHSONIAN_API_KEY`, `OPENVERSE_CLIENT_ID`, and `OPENVERSE_CLIENT_SECRET` must stay server-side.
