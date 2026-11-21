# Phase 53 — Public sector commitments LITE

**Status:** Complete (FULL)

**Exit:** Remaining = budget − encumbered − actual; de-encumber on bill/cancel; warn/enforce `budgetControlMode`.

## Shipped

1. `commitmentVsBudget` + `PurchaseDocument.encumbered` on open PO.
2. UI `/public-sector/commitments`.
3. **FULL (2026-11-21)** — Remaining subtracts posted bills/expenses as well as outstanding PO; PO de-encumbers when CLOSED or deleted; opening a PO respects budget control warn/enforce.

## Migration

`20261114220000_phase51_60_wave_cd` (no extra schema)

## Verify

```bash
pnpm exec vitest run tests/wave-b-deepen tests/wave-cd-51-60 tests/budget-deep
```