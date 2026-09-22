# Environments

| Environment | Configuration | Deployment rule |
| --- | --- | --- |
| Local | `.env.local`, never committed | Developer machine |
| Test | CI-injected variables | Every pull request |
| Staging | Vercel Preview variables | Preview branch deployment |
| Production | Vercel Production variables | Protected `main` deployment |

OpenScroll topic generation and entity resolution require the server-side `OPENAI_API_KEY` and `OPENAI_MODEL` variables in each environment. The live feed relevance evaluator uses Vercel AI Gateway with the `typesafe-ai/jev` model and requires gateway authentication: Vercel deployments use OIDC, while local development can use `AI_GATEWAY_API_KEY`. `JEV_RELEVANCE_THRESHOLD` controls the local acceptance threshold. The feed evaluator does not fall back to OpenAI. Secrets must be stored in the deployment provider, represented by name in `.env.example`, and never prefixed `NEXT_PUBLIC_` unless intentionally public. Database migrations must expose a deterministic `migrate` script before a datastore is introduced.
