# Phase 8 — Financial reporting

**Status:** ✅ Complete — 2026-08-29
**Depends on:** Phases 2, 4, 5, 6 and 7
**Blocks:** Phase 9 (period close needs a profit figure it can trust)

## Goal

The three statements a business is actually run and judged by — profit and loss,
balance sheet, statement of cash flows — plus the trade reports that explain
them, each computed from the ledger and each carrying its own proof that it is
right.

## Tasks

| # | Task | Where | Status |
| --- | --- | --- | --- |
| 8.1 | Report framework: ranges, comparatives, accrual/cash basis | `server/reports/framework.ts` | ✅ |
| 8.2 | Profit & loss, with % of income and a comparative period | `server/reports/statements.ts`, `app/(app)/reports/profit-loss/` | ✅ |
| 8.3 | Balance sheet, with its own balance assertion | `statements.ts`, `app/(app)/reports/balance-sheet/` | ✅ |
| 8.4 | Statement of cash flows, indirect, self-reconciling | `statements.ts`, `app/(app)/reports/cash-flow/` | ✅ |
| 8.5 | Trial balance, general ledger, ageing | delivered in Phases 2 and 4–5 | ✅ |
| 8.6 | Sales by customer and item, purchases by vendor, expenses by category | `server/reports/business.ts` + four pages | ✅ |
| 8.7 | Tax summary, split rate by rate | `business.ts`, `app/(app)/reports/tax-summary/` | ✅ |
| 8.8 | `account_period_balances` rollup | **not built** — [ADR-0010](../decisions/0010-no-balance-rollup-table.md) | ✅ decided |
| 8.9 | CSV export; settings carried in the URL | `server/reports/csv.ts`, `app/api/reports/[report]/` | ✅ |
| 8.10 | Dashboard: cash, profit, who owes what | `app/(app)/dashboard/` | ✅ |

## One query underneath everything

`accountFigures(orgId, range)` returns, for every account: the movement within
the range, the closing balance at `to`, and the opening balance the day before
`from`. Every statement in the system is a rearrangement of those three numbers.

That is deliberate. When the profit and loss and the balance sheet are computed
by two different queries, they eventually disagree, and finding out which one is
wrong takes a day. Here they cannot disagree, because there is only one query.

`present(type, raw)` flips the sign for credit-normal accounts, so revenue of
5,000 reads as 5,000 rather than −5,000, and a contra account still reads
negative — which is the information the reader needs.

## Cash basis

Cash basis counts only journals that touched a bank, undeposited funds or credit
card account, using an `EXISTS` subquery over the journal's own lines.

The obvious alternative — filter by document type, counting payments and
excluding invoices — is wrong, because a manual journal that moves cash is
invisible to it and a sales receipt paid into Undeposited Funds is counted twice.
Asking the ledger which journals touched cash is both simpler and correct.

## The balance sheet's missing term

Revenue and expense accounts are nominal. Their balances belong in equity, but
they only *move* there at the year-end close (Phase 9). So until a year is
closed, its profit sits in the profit-and-loss accounts and a balance sheet that
adds up only the equity accounts is short by exactly that amount.

The sheet therefore adds `accumulatedProfit` — the cumulative balance of every
profit-and-loss account to the reporting date. This is not a plug. Over every
account, Σdebit = Σcredit, therefore

```
assets − liabilities − equity − (revenue − expenses) = 0
```

and accumulated profit is the last term. Anything already closed has been zeroed
out of the nominal accounts and sits in Retained Earnings instead, so it is
counted exactly once either way. `difference` is asserted to be zero, and the
page says so on screen.

## The cash flow cannot fail to reconcile

Built on the same identity rather than on a classification. For any period,
Σ(debit − credit) = 0 across every account, so for the cash accounts:

```
Δcash = − Σ(debit − credit) over every non-cash account
```

Each non-cash account contributes exactly `−movement`. Sorting those
contributions into operating, investing and financing rearranges the statement;
it cannot change the total. Revenue and expense contributions sum to net income,
so they are shown that way and the working-capital accounts follow as
adjustments — which is the indirect method, arrived at rather than imitated.

A cash flow that does not tie to the bank is the commonest fault in a set of
accounts. This one is tested to reconcile over every sub-period, not only over
the year.

Accumulated depreciation is classified as **operating**, not investing, even
though it sits against a fixed asset: net income has already been reduced by the
depreciation charge, which moved no cash, so the credit belongs where it cancels
that. Putting it in investing would net it against capital expenditure and
understate what was actually spent on assets.

## Tax, rate by rate

A return is filed per rate, but a document line stores one tax figure — a code
carrying two rates posts their sum. The tax accounts cannot separate them either,
since several rates may post to the same Sales Tax Payable account.

So `taxSummary` recomputes the split with `computeLineTax`, the same function
that produced the posted total, over the same lines. The parts therefore add back
to what was actually charged by construction. The stored line amount is already
tax-exclusive, so the components are recomputed on that net with the code treated
as exclusive.

## Reports read the ledger; trade reports read the documents

`expensesByCategory` reads `journal_lines`, so an expense entered as a manual
journal is counted alongside one entered as a bill. `salesByCustomer`,
`salesByItem` and `purchasesByVendor` read the documents, net of tax, with credit
memos and vendor credits subtracting — tax collected is the agency's money
passing through and was never the customer's spend.

## Settings live in the URL

Period, basis and comparison are read from the query string by `readSettings`.
Nothing about a view is stored server-side, so a report someone is looking at can
be sent to someone else and be the same report, the back button works, and there
is no saved state to explain when the answer changes. The CSV endpoint parses the
same query string with the same function, so the file is the report on screen
rather than a second implementation of it.

Quarters run from the start of the fiscal year, not from January — a business
whose year starts in April reports April–June as Q1.

## CSV

Money is written as a plain decimal with no symbol and no separators, because a
formatted number arrives in a spreadsheet as text. A field beginning with `=`,
`+`, `-` or `@` is prefixed with an apostrophe: a customer named `=cmd|...` is a
real attack on whoever opens the file, not a hypothetical one. Negative numbers
are exempted, because they are numbers.

PDF export was dropped from 8.9. Every browser prints to PDF, the statements are
already laid out as documents, and shipping a rendering library to duplicate that
is weight without a benefit.

## Performance

No rollup table. Measured at 50,000 journal lines, a whole-ledger statement with
no date filter costs about 520 ms, of which roughly 260 ms is network round-trip.
[ADR-0010](../decisions/0010-no-balance-rollup-table.md) records the numbers and
the trigger for revisiting them.

## Verification

| What | How |
| --- | --- |
| P&L groups, comparatives, % of income | `tests/statements.test.ts` |
| Balance sheet balances at five different dates and on empty books | same |
| Cash flow reconciles over four different sub-periods | same |
| Cash basis excludes an unpaid invoice, includes paid rent | same |
| Tax split across two rates adds back to the posted total | `tests/business-reports.test.ts` |
| Credit memos and vendor credits subtract | same |
| Drafts and out-of-range documents excluded | same |
| Expenses read from the ledger, zero-movement accounts omitted | same |
| Fiscal quarters, prior-period and prior-year comparatives | `tests/report-presentation.test.ts` |
| CSV quoting, formula defusing, money format | same |

## What Phase 8 does not do

- No monthly-column P&L. The comparative period covers the question it answers.
- No saved or scheduled reports. The URL is the saved report.
- No budgets or variance — nothing to compare against yet.
- No drill-down from a cash-flow line; the statements drill through to the
  account ledger, which is where the detail actually is.

## ERP parity polish (Xero / QBO / Odoo-class)

Closed against mid-market peers without building a report designer or BI layer:

- Cash flow accepts a comparison period; screen and Excel show Comparison + Change.
- Statement Excel (P&L / BS / CF) adds a Change column whenever Comparison is on.
- Catalogue / aging / business Excel exports are Cover + Data multi-sheet packs.
- `GET /api/reports/[report]?format=csv|xlsx` (default xlsx); CSV uses the same
  human headers as Excel Summary (statements) or Data (tables).
