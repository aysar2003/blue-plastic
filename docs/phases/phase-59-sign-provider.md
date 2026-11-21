# Phase 59 — Sign provider webhook

**Status:** Complete (FULL)

## Shipped

1. `Organization.signProvider`, `SignRequest.externalId`.
2. **Deepen (2026-11-15)** — `webhookSecret` + outbound `X-Som-Signature` HMAC-SHA256; persists `{ id }` from webhook JSON; failures logged, native send still succeeds.
3. Webhook on create in `collab.service`, settings form.
4. `lib/erp/sign-provider.ts` + vitest mock fetch.
5. **Wave F (2026-11-21)** — inbound `POST /api/webhooks/sign?orgId=`: HMAC-verifies the raw JSON body, maps provider status → `SIGNED` / `DECLINED` on `SignRequest`, writes `SignWebhookEvent` (retry/log). `retryFailedSignWebhookEvents` re-applies `FAILED` rows. Unmapped status or bad HMAC → `REJECTED`.

## Migration

`20261114220000_phase51_60_wave_cd` (outbound)

`20261121202000_wave_f_deepen` (`sign_webhook_events`)
