# Phase 57 — Banking loans

**Status:** Complete (FULL) — Wave C 2026-11-21

## Shipped

1. `LoanProduct`, `LoanAccount`, `LoanScheduleLine`.
2. Create + schedule + `postDue` + UI `/banking/loans`.
3. **Deepen (2026-11-15)** — `postDue` collection journal: Dr `UNDEPOSITED_FUNDS`, Cr `LOAN_RECEIVABLE` (principal), Cr `LOAN_INTEREST_INCOME` (interest). System keys seeded on chart.
4. **FULL (2026-11-21)** — **Disbursement** journal to bank (Dr `LOAN_RECEIVABLE` / Cr bank); **overdue aging** buckets on the loans page; **accrue interest** helper that posts income once (`interestJournalId`) so later `postDue` does not double-count.

## Migration

`20261114220000_phase51_60_wave_cd`  
Wave C: `20261121191000_wave_c_deepen`
