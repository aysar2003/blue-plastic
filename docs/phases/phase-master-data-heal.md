# Master-data heal (Setup Fix Hub)

**Status:** Complete (FULL) · 2026-11-21

## Shipped

1. `setup-health.service` — SKU / reorder / item tax / customer country / org country gaps.
2. `setup-heal.service` — generate SKUs from names (`skuFromName`), default reorder `1` **only when reorderPoint is null** (clerk values are never overwritten), customer billing country from org, org country from localization pack.
3. Setup **Fix weaknesses** buttons + localization tax seed (see phase-40).
4. **Heal report CSV** — `/api/setup-health/csv` lists remaining gaps (SKU, reorder, tax, customer country, org country).
5. **Pack-aware tax on items** — `seedLocalizationTax` and **Apply pack tax to items** stamp the pack default tax code onto items missing sales/purchase tax. They write only those two fields — never `reorderPoint`.

## Verify

```bash
pnpm exec vitest run tests/setup-heal tests/localization-packs
```
