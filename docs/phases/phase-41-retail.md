# Phase 41 — Retail replenishment

**Status:** Complete (FULL)

## Shipped

1. `inventory.replenishmentSuggestions` + `createDraftReplenishmentTransfers` (DRAFT `StoreTransfer`, no stock move).
2. UI `/inventory/replenish`, nav + stock page link.
3. Helpers `lib/erp/replenishment.ts` + vitest.
4. **Deepen (2026-11-15)** — Cap suggested qty by source on-hand; **Post draft transfers** via existing transfer post path.
5. **FULL (2026-11-21)** — Item×store min/max (`StoreItemLevel`) + item `maxQty`; suggestions fill to max when below min. Price list `startsOn`/`endsOn` used in sales and POS when the window is active.

## Migration

`20261114200000_phase41_50_wave_b` · FULL `20261121181000_wave_a_deepen`

## Verify

```bash
pnpm exec vitest run tests/wave-b-41-50.test.ts lib/erp/price-list-window
```
