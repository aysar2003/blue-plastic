# Phase 52 — Holding portfolio

**Status:** Complete (FULL)

## Shipped

1. `/reports/portfolio` with ownership %, rolled NI, NCI.
2. CSV export `/api/reports/portfolio/export`.
3. Lib `lib/erp/portfolio.ts` + consol reuse.
4. **Wave D KPI strip** — cash, AR, stock, and NI at ownership %, with prior-year compare.

## Migration

`20261114220000_phase51_60_wave_cd` · Wave D `20261121200000_wave_d_deepen`

## Verify

```bash
pnpm exec vitest run tests/wave-d-deepen tests/wave-cd-51-60
```
