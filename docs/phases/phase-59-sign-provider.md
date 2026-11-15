# Phase 59 — Sign provider webhook LITE

**Status:** Complete (LITE)

## Shipped

1. `Organization.signProvider`, `SignRequest.externalId`.
2. **Deepen (2026-11-15)** — `webhookSecret` + outbound `X-Som-Signature` HMAC-SHA256; persists `{ id }` from webhook JSON; failures logged, native send still succeeds.
2. Webhook on create in `collab.service`, settings form.
3. `lib/erp/sign-provider.ts` + vitest mock fetch.

## Migration

`20261114220000_phase51_60_wave_cd`