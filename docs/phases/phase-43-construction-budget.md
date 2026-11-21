# Phase 43 — Construction budget

**Status:** Complete (FULL)

**Exit:** SOV lines (budget / % complete / this bill / retainage); site store issues on job cost; committed+actual on `/projects/progress`.

## Shipped

1. `projects.budgetAmount`.
2. `jobCostReport` / `listJobCostSummaries` budget vs actual.
3. UI budget field + table on `/projects/progress`.
4. **Deepen (2026-11-15)** — Committed encumbered PO on job cost; over-budget badge.
5. **FULL (2026-11-21)** — `ProjectSovLine` schedule of values (budget, % complete, this bill, retainage) with bill-this-line invoice; site-store issues (negative stock movements) rolled into job cost/progress.

## Migration

`20261114200000_phase41_50_wave_b` · FULL `20261121190000_wave_b_deepen`

## Verify

```bash
pnpm exec vitest run tests/wave-b-deepen lib/erp/sov
```