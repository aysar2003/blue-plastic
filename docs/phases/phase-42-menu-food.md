# Phase 42 — Menu food-cost

**Status:** Complete (FULL)

## Shipped

1. `hospitality-menu.service.menuCostReport` — GROUP items, component avg cost vs `salesPrice`.
2. UI `/pos/menu-cost`.
3. `lib/erp/menu-cost.ts` + vitest.
4. **Deepen (2026-11-15)** — Highlight margin below 25%; kitchen ↔ menu-cost cross-link.
5. **Wave E (2026-11-21)** — Period food-cost % on the same page: component SALE issues vs GROUP/POS sales, recipe vs actual variance.

## Migration

`20261114200000_phase41_50_wave_b` (no new columns)

Wave E: `20261121201000_wave_e_deepen` (no extra menu columns — report is derived)

## Verify

```bash
pnpm exec vitest run tests/wave-e-deepen.test.ts tests/wave-b-41-50.test.ts
```
