# Phase 42 — Menu food-cost

**Status:** Complete (LITE)

## Shipped

1. `hospitality-menu.service.menuCostReport` — GROUP items, component avg cost vs `salesPrice`.
2. UI `/pos/menu-cost`.
3. `lib/erp/menu-cost.ts` + vitest.
4. **Deepen (2026-11-15)** — Highlight margin below 25%; kitchen ↔ menu-cost cross-link.

## Migration

`20261114200000_phase41_50_wave_b` (no new columns)

## Verify

```bash
pnpm exec vitest run tests/wave-b-41-50.test.ts
```