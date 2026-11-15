# Phase 57 — Banking loans LITE

**Status:** Complete (LITE)

## Shipped

1. `LoanProduct`, `LoanAccount`, `LoanScheduleLine`.
2. Create + schedule + `postDue` + UI `/banking/loans`.
3. **Deepen (2026-11-15)** — `postDue` collection journal: Dr `UNDEPOSITED_FUNDS`, Cr `LOAN_RECEIVABLE` (principal), Cr `LOAN_INTEREST_INCOME` (interest). System keys seeded on chart.

## Migration

`20261114220000_phase51_60_wave_cd`