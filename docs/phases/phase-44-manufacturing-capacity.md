# Phase 44 — Manufacturing overload

**Status:** Complete (FULL)

**Exit:** Work-center holiday/exception dates zero that day's capacity.

## Shipped

1. `capacityReport` uses summed `capacityByWeekday` when set (`lib/erp/routing-capacity.ts`).
2. Overload badge already on `/inventory/routing`.
3. **Deepen (2026-11-15)** — Overload WO drill-down + capacity CSV export.
4. **FULL (2026-11-21)** — `WorkCenterException` holiday table; weekly capacity subtracts exception days.

## Migration

FULL `20261121190000_wave_b_deepen`

## Verify

```bash
pnpm exec vitest run tests/wave-b-deepen tests/wave-b-41-50
```