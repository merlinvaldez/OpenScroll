# Epic D Rights Notes

Epic D implements OS-021 through OS-027 as the rights, licensing, attribution, and download-safety layer for OpenScroll.

## Ticket Coverage

| Ticket | Implementation |
| --- | --- |
| OS-021 Normalized license ontology | `@openscroll/content` exposes `LICENSE_ONTOLOGY` with qualified-open, blocked, and unknown license records plus alias and URL normalization. |
| OS-022 Open License Gate | `openLicenseGate` and gate decisions classify every candidate as `accept`, `review`, or `reject`; only accepted items can enter the main Scroll or download path. |
| OS-023 Item-level source verification | `verifySourceRights` records source, original-source URL, evidence, verifier, timestamp, and verification status on each rights passport. |
| OS-024 Rights-review queue | Connector conformance and ingestion runs now return deterministic `reviewQueue` records for ambiguous or unverified candidates instead of silently dropping them. |
| OS-025 Attribution engine | `createAttributionNotice` builds required attribution text, markdown, obligations, license, source, creator, and share-alike metadata. |
| OS-026 "Why open?" UI | Feed details render the rights explanation from each canonical content object's `rights.whyOpen` passport without adding clutter to the main feed. |
| OS-027 Rights-safe downloads | `createRightsSafeDownloadPolicy` blocks downloads unless the item is gate-accepted and carries reuse obligations into local saves and feed details. |

## Boundaries

Epic D still uses fixture-backed content from Epic C. It makes the governance path real before live API ingestion: anything restricted rejects, anything ambiguous enters review, and accepted items carry the attribution and download rules needed by the user interface.

The consumer product remains account-free and has no upload, publishing, profile, comment, or public collection surface.
