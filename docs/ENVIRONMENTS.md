# Environments

| Environment | Purpose | Deployment |
| --- | --- | --- |
| Local | Development and component testing | `npm run dev` |
| Test | Unit and browser automation | CI runner |
| Preview | Review each proposed change | Vercel preview |
| Production | Public approved build | Vercel production |

Epic A requires no secrets. Future environment keys must be documented in `.env.example`, stored outside Git, and validated by name without printing values.
