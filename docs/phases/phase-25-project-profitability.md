# Phase 25 — Project profitability (L6)

**Status:** Complete (FULL) — Wave H 2026-11-25

## Shipped

- Real job P&L: posted sales income, purchase cost, stock COGS on those sales, timesheet labour.
- **Labour cost** = hours × `costRate` (falls back to `billableRate` when cost is blank).
- **Labour charge** = hours × `billableRate` (display; not subtracted from profit).
- Service: `server/services/project-profitability.service.ts`.
- Pure arithmetic: `lib/project-profitability.ts` (+ Vitest known-margin fixture).
- Report `project-profitability` uses the service (replaces lite subtotal-only view).
- Project detail shows a 12-month Job P&L strip with cost and charge columns.

## Explicitly out

WIP revenue recognition, multi-currency job books.
