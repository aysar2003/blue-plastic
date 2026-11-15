# Phase — Budget deep-complete

Date: 2026-11-15

Closes the eight gaps on Accounting → Budgets so a yearly plan can be prepared, approved, and compared monthly.

## Delivered

1. **Monthly lines** — `BudgetLine.month` (1–12); migration spreads prior annual totals evenly across months in range.
2. **Class / department** — optional `trackingCategoryId` per line (plus existing fund class on budget header).
3. **Draft → Approve → Revise** — `BudgetStatus` + `version` / `supersedesId`; revise clones to a new draft; approve supersedes prior.
4. **Copy / % inflate** — copy to a new date range with optional percent.
5. **CSV import** — `accountCode`, `month`, `amount`, optional `className` (dry-run then commit).
6. **Monthly Budget vs Actual** — report columns per month (budget + actual) plus period totals; includes BS account types when budgeted.
7. **Balance sheet / cash** — budgetable account types: REVENUE, COGS, EXPENSE, ASSET, LIABILITY, EQUITY.
8. **Overspend control** — feature flag `enforceBudgetControl` (Apps & features → Accounting, default off). Blocks BILL/EXPENSE posts and EXPENSE/COGS journal lines against **APPROVED** monthly cells. Also UI: Collapse to first month / Spread evenly.

## Migration

`prisma/migrations/20261115140000_budget_deep`

## Permissions

Edit / approve / import use existing `report:read` (same as prior budget create).

## Out of scope

Second tracking dimension; blocking revenue shortfall; multi-currency budgets.
