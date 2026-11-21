# Phase 13 — Ledger depth

**Status:** Complete (FULL) — Wave C 2026-11-21

## Shipped

- Fixed asset categories and register (`/accounting/fixed-assets`) with straight-line monthly depreciation posting adjusting journals.
- FX revaluation workflow plus **open foreign AR/AP by currency** on `/accounting/fx-revaluation`.
- Period close checklist warns on foreign-currency activity (links to revaluation).
- Sign-in sliding-window rate limit (`lib/auth-rate-limit.ts`, `verifyCredentials`).
- Invitation email when org SMTP is configured (`membership.service` invite, best-effort).
- **FX payment (FULL):** paying a foreign invoice/bill converts cash at the **payment-date** rate (`FxDailyRate` on or before the payment date, else the rate on the payment). AR/AP stays at the document rate; residual posts to `EXCHANGE_GAIN_LOSS`.

## Migration

`20261102120000_phases_13_17` (shared with later phases).  
Wave C: `20261121191000_wave_c_deepen` (`fx_daily_rates`).
