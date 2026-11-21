# Phase 51 — Franchise

**Status:** Complete (FULL)

## Shipped

1. `Organization.franchiseRoyaltyPercent` on child companies.
2. `franchise.catalogPush`, `franchise.accrueRoyalty`, UI `/reports/franchise`.
3. **Deepen (2026-11-15)** — Royalty accrual on parent: Dr `ROYALTY_RECEIVABLE`, Cr `ROYALTY_INCOME`.
4. **Wave D** — Royalty statement per child (sales × %) with CSV (`/api/reports/franchise/export`). Brand P&L roll-up on the same page when any child has a royalty %.

## Migration

`20261114220000_phase51_60_wave_cd` · Wave D `20261121200000_wave_d_deepen`

## Verify

```bash
pnpm exec vitest run tests/wave-d-deepen tests/wave-cd-51-60
```
