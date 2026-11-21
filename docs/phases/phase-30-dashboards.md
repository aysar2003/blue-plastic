# Phase 30 — SME BI dashboards (L8)

**Status:** Complete (FULL)

## Shipped

1. **Dashboard** + **DashboardTile** (KPI, report link, or spark metric).
2. Values resolved only from existing business-overview / home KPI / report builders.
3. UI at `/reports/dashboards`; Reports hub tile.
4. Optional tile threshold banner on the board (no new email channel).
5. Vitest: tile helpers + threshold banner logic.
6. **Wave D** — Company snapshot pulse also shows stock value, open service jobs, and van stock.

## Explicitly out

Data warehouse, Slack/Drive delivery, ad-hoc SQL cubes.

## Verify

```bash
pnpm exec vitest run tests/wave-d-deepen tests/dashboard-board tests/company-snapshot
```
