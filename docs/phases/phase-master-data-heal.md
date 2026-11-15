# Master-data heal (Setup Fix Hub)

**Status:** Complete (LITE) · 2026-11-15

## Shipped

1. `setup-health.service` — SKU / reorder / customer country / org country gaps.
2. `setup-heal.service` — generate SKUs from names (`skuFromName`), default reorder `1`, customer billing country from org, org country from localization pack.
3. Setup **Fix weaknesses** buttons + localization tax seed (see phase-40).

## Verify

```bash
pnpm exec vitest run tests/setup-heal tests/localization-packs
```
