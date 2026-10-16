# 04 — Development Roadmap

Nine phases. Each is shippable on its own and leaves the system in a correct state;
none is a "big bang" that only works once the next one lands.

The ordering is driven by one constraint: **the ledger must be correct before
anything writes to it.** Sales, purchases and banking are all just document types
that produce journals, so they cannot be built before the engine that accepts those
journals exists. Everything after Phase 2 is, structurally, the same work repeated
with different debits and credits.

## Dependency graph

```
  P1 Foundation & Identity
        │
        ▼
  P2 Accounting Core  ──────────────────────────────┐
        │                                           │
        ▼                                           │
  P3 Master Data & Tax                              │
        │                                           │
        ├──────────────┬──────────────┐             │
        ▼              ▼              │             │
  P4 Sales / AR   P5 Purchases / AP   │             │
        │              │              │             │
        └──────┬───────┘              ▼             ▼
               ▼                 P7 Inventory   P8 Reporting
        P6 Banking & Cash             │             │
               │                      │             │
               └──────────┬───────────┴─────────────┘
                          ▼
                 P9 Period Close & Year-End
                          │
                          ▼
                 P10 Hardening & Polish
```

P7 (Inventory) depends on P3 for items and on P4/P5 for the documents that move
stock, but its *engine* only needs P2. It is scheduled after P5 so that both the
buy side and the sell side exist to move stock in and out.

P8 (Reporting) needs only P2 for the statement trio (TB, P&L, BS); the sales and
purchase reports arrive with their phases. It is scheduled late so that reports are
written once against a full ledger rather than three times against a growing one.

---

## Phase 1 — Foundation & Identity

**Goal:** a secure, fast, multi-tenant-ready application shell that anything can be
built inside, with the primitives every later phase depends on.

| # | Task |
| --- | --- |
| 1.1 | Next.js 16 + TypeScript strict + Tailwind v4 + shadcn/ui, path aliases, ESLint layering rules |
| 1.2 | Prisma + PostgreSQL wiring, connection singleton, `.env.example`, db scripts |
| 1.3 | Foundation schema: `Organization`, `User`, `Membership`, NextAuth tables, `AuditLog`, `DocumentSequence` |
| 1.4 | NextAuth v5: credentials provider, JWT with `orgId`/`role`/`membershipVersion`, edge-safe middleware split |
| 1.5 | RBAC: `Role`/`Permission` model, permission matrix, `requireOrgContext(permission)` |
| 1.6 | `OrgContext` plumbing and tenant-scoping guarantees |
| 1.7 | Money (`Decimal`) and calendar-date primitives + formatting |
| 1.8 | Error model (`AppError`), `ActionResult`, server-action wrapper, route-handler envelope |
| 1.9 | Audit log service (write-through, inside caller's transaction) |
| 1.10 | Document numbering service with row-lock allocation |
| 1.11 | App shell: sidebar, topbar, user menu, theme, responsive layout, loading/error/empty states |
| 1.12 | Auth screens: sign in, first-run setup (create organisation + owner), sign out |
| 1.13 | Settings: organisation profile, fiscal year & currency; users & roles management |
| 1.14 | TanStack Query provider + typed API-fetch helper |
| 1.15 | Vitest setup; unit tests for money, dates, permissions, sequences; integration test for tenant isolation |
| 1.16 | Seed script: organisation + owner user |

**Exit criteria:** a user can sign in, land on an app shell, see their organisation
settings, invite and role-manage users; `pnpm verify` (lint + typecheck + test)
passes; cross-tenant access is proven impossible by test.

**Explicitly not in Phase 1:** any accounting concept. No accounts, no journals, no
money movement. Mixing shell work with ledger work is how ledger work gets rushed.

---

## Phase 2 — Accounting Core

**Goal:** the double-entry engine, and nothing that isn't.

| # | Task |
| --- | --- |
| 2.1 | `LedgerAccount` schema, types/subtypes, hierarchy, `systemKey` |
| 2.2 | `FiscalYear` / `AccountingPeriod` schema + generation for a year |
| 2.3 | `Journal` / `JournalLine` schema |
| 2.4 | All integrity triggers R1–R10 as raw SQL migrations + `db:verify` |
| 2.5 | Posting engine `postJournal` / `reverseJournal` |
| 2.6 | Chart-of-accounts seeder (default CoA for a goods-trading business) + system accounts |
| 2.7 | Chart of accounts UI: tree, create/edit/deactivate, merge guard |
| 2.8 | Manual journal entry UI with live debit/credit balancing |
| 2.9 | Opening balances workflow via Opening Balance Equity |
| 2.10 | Trial balance + general ledger + account register (drill-down) |
| 2.11 | Period open/close UI and guard |
| 2.12 | Test suite: every integrity rule, reversal semantics, period guard, balanced-posting property tests |

**Exit criteria:** a manual journal can be posted, reversed and inspected; an
unbalanced journal is impossible from the API *and* from psql; the trial balance
nets to zero.

---

## Phase 3 — Master Data & Tax

| # | Task |
| --- | --- |
| 3.1 | Customers (billing/shipping address, terms, opening balance, credit limit) |
| 3.2 | Vendors (terms, tax id, opening balance, default expense account) |
| 3.3 | Items: service, non-inventory, inventory — with account mappings |
| 3.4 | Tax agencies, tax codes, tax rates, compound and inclusive/exclusive handling |
| 3.5 | Payment terms and due-date calculation |
| 3.6 | Shared list UX: search, filter, pagination, bulk activate/deactivate, CSV import |
| 3.7 | Opening balance posting for customers/vendors through AR/AP + OBE |

**Exit criteria:** master data exists with correct account mappings and a customer
opening balance lands in AR and on the aging report.

---

## Phase 4 — Sales / Accounts Receivable

| # | Task |
| --- | --- |
| 4.1 | Invoice document + lines, totals, tax, terms, due date |
| 4.2 | Invoice posting builder + edit-as-reverse-and-repost |
| 4.3 | Estimates and estimate → invoice conversion |
| 4.4 | Sales receipts (cash sales) |
| 4.5 | Customer payments with application to invoices, partial and over-payment |
| 4.6 | Credit memos and their application |
| 4.7 | Refund receipts |
| 4.8 | AR aging, customer statement, customer transaction list |
| 4.9 | Document numbering, PDF/print view, email-ready layout |
| 4.10 | Void/delete semantics |

---

## Phase 5 — Purchases / Accounts Payable

| # | Task |
| --- | --- |
| 5.1 | Bills + lines (expense, item, fixed asset) |
| 5.2 | Bill posting builder |
| 5.3 | Expenses (immediate cash/card purchases) |
| 5.4 | Vendor credits and application |
| 5.5 | Bill payments with application, partial payment, batch pay |
| 5.6 | Purchase orders and PO → bill conversion |
| 5.7 | AP aging, vendor transaction list, unpaid bills |

---

## Phase 6 — Banking & Cash

| # | Task |
| --- | --- |
| 6.1 | Bank & credit-card account registers with running balance |
| 6.2 | Transfers between accounts |
| 6.3 | Deposits, including clearing Undeposited Funds |
| 6.4 | Bank statement import (CSV/OFX) into a staging table |
| 6.5 | Matching engine: suggest matches to existing documents |
| 6.6 | Reconciliation workflow: statement balance, cleared items, difference must be zero, lock on finish |
| 6.7 | Reconciliation report and undo-reconciliation with audit |

---

## Phase 7 — Inventory

| # | Task |
| --- | --- |
| 7.1 | `InventoryTransaction` ledger + weighted-average cost engine |
| 7.2 | COGS posting integrated into invoice / sales receipt / credit memo |
| 7.3 | Receipt of stock through bills and purchase orders |
| 7.4 | Inventory adjustments (quantity and value) |
| 7.5 | Negative-stock policy and cost true-up |
| 7.6 | Stock on hand, inventory valuation summary/detail, reorder report |
| 7.7 | Reconciliation test: inventory ledger value == Inventory Asset GL balance |

---

## Phase 8 — Financial Reporting

| # | Task |
| --- | --- |
| 8.1 | Report framework: date ranges, comparison periods, accrual/cash basis, drill-down |
| 8.2 | Profit & Loss (% of income, comparative period) — monthly columns dropped, the comparative answers the question |
| 8.3 | Balance Sheet (with self-check assertion) |
| 8.4 | Statement of Cash Flows (indirect) |
| 8.5 | Trial balance, general ledger detail, journal report — delivered in Phases 2 and 4–5 |
| 8.6 | Sales by customer/item, purchases by vendor, expenses by category |
| 8.7 | Tax summary, split rate by rate for filing |
| 8.8 | ~~`account_period_balances` rollup~~ — not built; measured and declined in [ADR-0010](./decisions/0010-no-balance-rollup-table.md) |
| 8.9 | CSV export; report settings carried in the URL. PDF dropped — the browser already prints one |
| 8.10 | Dashboard: cash position, income vs expense, AR/AP aging summary, recent activity |

---

## Phase 9 — Period Close & Year-End

| # | Task |
| --- | --- |
| 9.1 | Adjusting journal entries flagged and reportable separately |
| 9.2 | Month-end close checklist (unreconciled items, unapplied payments, out-of-balance checks) |
| 9.3 | Year-end closing entry to Retained Earnings, reversible |
| 9.4 | Period lock/unlock with audit and permission gate — delivered in Phase 2, extended here with the year lock |
| 9.5 | Prior-period comparatives after close — [ADR-0011](./decisions/0011-closing-entries-excluded-from-the-profit-and-loss.md) |

---

## Phase 10 — Interface & Hardening

Re-scoped by the owner on 2026-08-29 towards the interface, which is where the
remaining cost was: the accounting has been right since Phase 2.

| # | Task |
| --- | --- |
| 10.1 | Sidebar reduced to modules; related screens become tabs inside each module |
| 10.2 | Searchable comboboxes for every record picker, with inline create where it is safe |
| 10.3 | One dialog primitive and one select primitive; retire the hand-rolled duplicates |
| 10.4 | Navigation progress indicator |
| 10.5 | Frontend performance pass — fewer client components, no unused libraries in the first load |
| 10.6 | Command palette and keyboard shortcuts for common actions |
| 10.7 | Help and system guidance inside the application, in place of a separate manual |
| 10.8 | Quick Create — one button that starts any document or record |
| 10.9 | Calendar date picker in place of the browser's date input |
| 10.10 | Sortable column headers and pagination on the list screens |
| 10.11 | Default accounts — which account each system role posts to, editable |
| 10.12 | Every form disables its button while saving; success is green, not red |
| 10.13 | Edit routes, row action menus, print, and CSV export on every list |
| 10.14 | Separate category lines from item lines: purchases get both sections, sales get items only |

| 10.15 | Aging reports read the control account by counterparty, so they agree with the ledger |
| 10.16 | Manual journals reach the whole chart, with the customer or vendor the line requires |
| 10.17 | One verb — Delete — on every list and record, actually removing the transaction ([ADR-0013](./decisions/0013-soft-delete-for-transactions.md)) |
| 10.18 | Partial receiving against a purchase order, with its own page |
| 10.19 | Transaction detail by account: reports drill to the transactions, and on to the document |
| 10.20 | Journal form: entry number, a Name on every line, no preset menu |

Carried forward, unbuilt: attachments on documents, full-text search, rate
limiting, backup/restore runbook, multi-currency activation, and an end-to-end
browser test suite covering a full accounting cycle from opening balances to
year-end close.

---

## Phase 11 — The practical gaps

**In progress** (started 2026-10-16). Written on 2026-09-01 after reviewing the
system against what QuickBooks Online and Desktop actually give a small trading
business day to day. Task detail: [phases/phase-11-practical-gaps.md](./phases/phase-11-practical-gaps.md).

The selection rule was deliberate and narrow: **something a real business does
every week, that this system either cannot do or makes somebody do by hand.** Not
"QuickBooks has it". Payroll, time tracking, projects, budgeting, 1099s,
multi-entity consolidation and app-store integrations are all deliberately out —
they are a different product, and adding them would cost more than the whole of
Phases 1–10.

Ordered by what it costs to live without it.

### 11a — Things people do weekly and currently cannot

| # | Task | Why it earns a place |
| --- | --- | --- |
| 11.1 | **Attachments on documents** — the vendor's invoice, the delivery note, the receipt photograph, stored against the bill | The single most-used feature in QuickBooks that this has no answer for. A bill with no paperwork behind it is a bill somebody has to go and find a folder for. Carried forward from Phase 10 since the original sketch |
| 11.2 | **Recurring transactions** — a template plus a schedule, for rent, subscriptions, standing bills and the monthly depreciation journal | Every business has a dozen entries that are identical every month. Re-keying them is where typos and omissions come from. QuickBooks calls these memorised transactions and they are used constantly |
| 11.3 | **Email a document to a customer or vendor** — invoice, statement, purchase order | The `invoice:send` permission has existed since Phase 1 and nothing implements it. Today the only route out of the system is to print. The org already carries the pieces; what is missing is a transport and a template |
| 11.4 | **Progress invoicing from an estimate** — invoice part of a quotation, track what is left | The exact mirror of the partial receiving built in 10.26, and its absence is now an asymmetry: a purchase order can be received in instalments and an estimate still becomes an invoice all at once or not at all |
| 11.5 | **Billable expenses** — mark a cost as rechargeable to a customer and pull it onto their next invoice | A trading business that buys freight or a part on a customer's behalf currently has to remember, and re-key it. This is the feature that stops recharges being forgotten |
| 11.6 | **Aged detail reports** — the aging broken down per document, not only per customer | The summary answers "who owes"; collecting money needs "which invoice, dated when". Today that means opening each customer in turn |

### 11b — Control and correctness

| # | Task | Why it earns a place |
| --- | --- | --- |
| 11.7 | **Enforce the customer credit limit** — warn, or block, when a new invoice would exceed it | `Customer.creditLimit` has been stored since Phase 3 and is read by nothing. A limit that is recorded and never checked is worse than none, because somebody believes it is working |
| 11.8 | **Automatically reversing journals** — mark an accrual to reverse itself on the first day of the next period | Standard month-end practice. Doing it by hand means remembering, and the entries that get forgotten are the accruals that then double-count |
| 11.9 | **Per-document change history** — surface the audit log on the record it belongs to | `AuditLog` has recorded every change since Phase 1 and is only visible as one long organisation-wide list. "Who changed this bill, and when" is a question asked about a specific bill |
| 11.9a | **A "recently deleted" view** — list soft-deleted transactions with who deleted them and why, and restore one | Deleting is now one click and the record vanishes completely. The audit log holds the answer to "what happened to INV-00042" but somebody has to know to go and look, and there is no way back from a mis-click ([ADR-0013](./decisions/0013-soft-delete-for-transactions.md)) |
| 11.10 | **Bank rules** — remember how an imported line was categorised and apply it next time | The matching engine suggests against existing documents. A recurring bank charge matches nothing and is re-categorised by hand every month |
| 11.11 | **Duplicate warnings** — a second bill with the same vendor reference, a second payment of the same amount on the same day | Paying a vendor twice is the expensive mistake, and it is cheap to catch at entry |

### 11c — Worth doing, lower cost of omission

| # | Task | Why it earns a place |
| --- | --- | --- |
| 11.12 | **Classes or locations** — one optional dimension on every transaction, reportable | A trading business with two shops or two product lines wants a profit and loss per shop. One dimension covers most of it; QuickBooks' full class/location/project trio does not earn its complexity here |
| 11.13 | **Item bundles** — a group of items sold as one line | Common for a goods business selling a kit. Purely a sales-side convenience; it moves the stock of its components |
| 11.14 | **Customer price levels** — a percentage or a fixed price per customer | Trade versus retail pricing, currently re-typed on every invoice |
| 11.15 | **Saved report settings** — name a report's date range, basis and comparison, and return to it | Every month-end runs the same five reports with the same settings. The URL already carries them; what is missing is somewhere to keep one |
| 11.16 | **Reorder alerts on the dashboard** — the reorder report exists but nothing surfaces it | A stock-out is a lost sale, and the data to prevent it is already computed |
| 11.17 | **Batch invoicing** — one screen, many customers, the same charge | Useful for recurring service charges; substantially covered by 11.2 if that lands first |

### Deliberately excluded

Payroll, time tracking and job costing, project profitability, budgets versus
actual, fixed-asset registers with depreciation schedules, 1099/vendor tax
filing, multi-entity consolidation, inventory assemblies with a bill of
materials, sales-order and backorder management, an app marketplace, and a
customer-facing portal.

Each is a real QuickBooks feature. Each is also a subsystem rather than a
feature, and none of them is what stops this system being used tomorrow morning.
