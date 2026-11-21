# Phase 33 — Close enterprise UX (L1 / L8)

**Status:** Complete (FULL)

## Shipped

1. **Close pack** CSV (TB + P&L + BS + checklist) via `/api/periods/[id]/close-pack` and Periods month page.
2. Feature flag **`closeHardGates`**: elevates bank recon, MATCH_HOLD bills, and open pick waves from warning → blocked. Month close refuses while the checklist is blocked.
3. Checklist keys extended in `close-checklist.ts`.
4. **Wave D** — Optional **`closeSecondApprover`**: when hard gates are on, closing a month submits an `ACCOUNTING_PERIOD` request with two approval levels (Approvals inbox). The period stays open until both approvers decide.

## Migration

`20261106200000_phase31_33_wms_bi_close` · Wave D `20261121200000_wave_d_deepen`

## Explicitly out

Multi-book statutory close, configurable RE account.

## Verify

```bash
pnpm exec vitest run tests/wave-d-deepen tests/close-hard-gates
```
