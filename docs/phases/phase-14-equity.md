# Phase 14 — Equity & multi-entity

**Status:** Complete (FULL)

## Shipped

- Shareholders register and equity events (contribution, draw, dividend) at `/accounting/equity`.
- Owner's equity statement at `/reports/owners-equity`.
- Event posting hits statement accounts: contribution → owner's equity (or the shareholder capital account), draw → drawings, dividend → retained earnings.
- CSV export: shareholder register (`/api/exports/equity-register`) and period equity movement (`/api/exports/equity-movement`).
- Multi-company P&L roll-up remains `/reports/companies` (parentOrgId children).

## Non-goals

- Cap table rounds, stock options.

## Migration

Wave D `20261121200000_wave_d_deepen` (no equity table change; statement posting + CSV).

## Verify

```bash
pnpm exec vitest run tests/wave-d-deepen
```
