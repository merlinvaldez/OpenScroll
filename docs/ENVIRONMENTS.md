# Environments

| Environment | Configuration | Deployment rule |
| --- | --- | --- |
| Local | `.env.local`, never committed | Developer machine |
| Test | CI-injected variables | Every pull request |
| Staging | Vercel Preview variables | Preview branch deployment |
| Production | Vercel Production variables | Protected `main` deployment |

Epic A requires no secrets. Future secrets must be stored in the deployment provider, represented by name in `.env.example`, and never prefixed `NEXT_PUBLIC_` unless intentionally public. Database migrations must expose a deterministic `migrate` script before a datastore is introduced.
