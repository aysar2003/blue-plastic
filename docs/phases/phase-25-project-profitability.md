# Phase 25 — Project profitability (L6)

**Status:** Complete

## Shipped

- Real job P&L: posted sales income, purchase cost, stock COGS on those sales, timesheet labour (hours × billable rate).
- Service: `server/services/project-profitability.service.ts`.
- Pure arithmetic: `lib/project-profitability.ts` (+ Vitest known-margin fixture).
- Report `project-profitability` uses the service (replaces lite subtotal-only view).
- Project detail shows a 12-month Job P&L strip.

## Explicitly out

Separate internal cost rates vs charge-out, WIP revenue recognition, multi-currency job books.
