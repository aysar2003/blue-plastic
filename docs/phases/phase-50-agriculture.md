# Phase 50 — Agriculture pack

**Status:** Complete (FULL)

## Shipped

1. Pack `agriculture` in `lib/packs/types.ts` + `registry.ts` (onboarding tile).
2. `stores.isFarm`, `item_lots.originLabel`.
3. `agriculture.seasonalCostReport` + UI `/agriculture`.
4. **Deepen (2026-11-15)** — Farm store / origin filters; receive origin hint on farm stores.
5. **Wave E (2026-11-21)** — Season = project/class on lots; filter + link on the seasonal cost page.

## Migration

`20261114200000_phase41_50_wave_b`

Wave E: `20261121201000_wave_e_deepen` (`item_lots.projectId`, `item_lots.trackingCategoryId`)
