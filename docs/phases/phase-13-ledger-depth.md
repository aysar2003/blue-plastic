# Phase 13 — Ledger depth

**Status:** Complete (SME scope)

## Shipped

- Fixed asset categories and register (`/accounting/fixed-assets`) with straight-line monthly depreciation posting adjusting journals.
- FX revaluation workflow plus **open foreign AR/AP by currency** on `/accounting/fx-revaluation`.
- Period close checklist warns on foreign-currency activity (links to revaluation).
- Sign-in sliding-window rate limit (`lib/auth-rate-limit.ts`, `verifyCredentials`).
- Invitation email when org SMTP is configured (`membership.service` invite, best-effort).

## Deferred / parent

- Full multi-currency payment posting refinements (parent agent).

## Migration

`20261102120000_phases_13_17` (shared with later phases).
