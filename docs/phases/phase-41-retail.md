# Phase 41 — Retail replenishment

**Status:** Complete (LITE)

## Shipped

1. `inventory.replenishmentSuggestions` + `createDraftReplenishmentTransfers` (DRAFT `StoreTransfer`, no stock move).
2. UI `/inventory/replenish`, nav + stock page link.
3. Helpers `lib/erp/replenishment.ts` + vitest.
4. **Deepen (2026-11-15)** — Cap suggested qty by source on-hand; **Post draft transfers** via existing transfer post path.

## Migration

`20261114200000_phase41_50_wave_b`

## Verify

```bash
pnpm exec vitest run tests/wave-b-41-50.test.ts
```