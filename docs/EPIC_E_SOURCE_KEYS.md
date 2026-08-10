# Source API Key Integration Notes

This update wires the source credentials provided during Epic E without committing secret values.

## Implemented

| Source | Implementation |
| --- | --- |
| Europeana | `createEuropeanaClient` reads `EUROPEANA_API_KEY`, calls the Search API with open reusability filtering, and normalizes records into Universal Content Object input. |
| Smithsonian Open Access | `createSmithsonianClient` reads `SMITHSONIAN_API_KEY` or `DATA_GOV_API_KEY` and normalizes EDAN/Open Access rows into source records. |
| DPLA | `createDplaClient` reads `DPLA_API_KEY`; `requestDplaApiKey` and `scripts/request-dpla-api-key.mjs` model the provider email request flow while keeping the actual key pending. |
| Openverse | `createOpenverseClient` supports the register/token/client-credentials flow and sends Bearer tokens for search. `scripts/register-openverse-app.mjs` calls the registration endpoint. Live Openverse candidates still fail into review until original-source rights are verified. |

## Runtime Boundary

`.env.local` can contain real values for local development. `.env.example` only names variables. Production and preview secrets must be stored in the deployment provider.

The code intentionally exposes credential status without exposing credential values through `sourceCredentialStatus`.

## Rights Boundary

Provider APIs can supply candidate metadata, but OpenScroll's rights gate remains the final authority:

- Europeana searches request openly reusable records.
- Smithsonian Open Access records normalize to CC0.
- DPLA records are accepted only when rights text normalizes to a qualifying open license.
- Openverse records remain source-unverified by default because Epic D requires original-source recheck before a candidate enters the main Scroll.
