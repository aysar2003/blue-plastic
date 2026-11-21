# Phase 46 — Retainer remaining

**Status:** Complete (FULL)

**Exit:** Utilization hours; WIP aging; replenish retainer → unearned invoice.

## Shipped

1. `projects.retainerRemaining`.
2. `billRetainer` decrements; `billWipFromTime` blocks when WIP > remaining.
3. UI `/projects/wip` shows retainer left.
4. **Deepen (2026-11-15)** — Low-watermark banner when retainer remaining is low.
5. **FULL (2026-11-21)** — Utilization uses logged hours as available when timesheets exist; WIP aging buckets on `/projects/wip`; replenish retainer invoices and defers to Unearned Revenue while increasing remaining.

## Migration

`20261114200000_phase41_50_wave_b` (no extra schema)

## Verify

```bash
pnpm exec vitest run tests/wave-b-deepen tests/verticals/p5
```