# Phase 11 — The practical gaps

**Status:** ✅ Complete — started 2026-10-16, finished 2026-11-01
**Depends on:** Phases 1–10
**Blocks:** nothing planned beyond this

## Goal

Close the weekly gaps a small trading business hits in QuickBooks that this
system still cannot do, or forces somebody to do by hand. Selection rule:
**something done every week, that costs money or time when missing** — not
"QuickBooks has it".

Ordered by cost of living without it. Detail and exclusions live in
[04-roadmap.md](../04-roadmap.md#phase-11--the-practical-gaps).

## Tasks

### 11a — Weekly work that currently cannot be done

| # | Task | Where | Status |
| --- | --- | --- | --- |
| 11.1 | Attachments on documents (PDF / photo on bills, invoices, POs, journals) | `LedgerFile`, `DocumentAttachments`, sales/purchase/journal detail | ✅ |
| 11.2 | Recurring transactions (template + schedule) | `RecurringTemplate`, `/banking/recurring` | ✅ |
| 11.3 | Email a document (invoice, statement, PO) | `invoice:send`, transport + template | ✅ |
| 11.4 | Progress invoicing from an estimate | Sales convert / estimate balance | ✅ |
| 11.5 | Billable expenses → pull onto next invoice | Purchase lines + sales | ✅ |
| 11.6 | Aged detail reports (per document) | AR/AP aging detail catalogue reports | ✅ |

### 11b — Control and correctness

| # | Task | Where | Status |
| --- | --- | --- | --- |
| 11.7 | Enforce customer credit limit | `sales.service` create/update on posted invoices | ✅ |
| 11.8 | Automatically reversing journals | Journal + period open | ✅ |
| 11.9 | Per-document change history | `DocumentHistory` on sales, purchase & journal detail | ✅ |
| 11.9a | Recently deleted / restore (Trash already covers list; polish restore) | Trash | ✅ |
| 11.10 | Bank rules for categorising imports | Banking import | ✅ |
| 11.11 | Duplicate warnings (bill ref, same-day payment) | Purchase / payment entry | ✅ |

### 11c — Lower cost of omission

| # | Task | Status |
| --- | --- | --- |
| 11.12 | Classes / locations | ✅ |
| 11.13 | Item bundles | ✅ |
| 11.14 | Customer price levels | ✅ |
| 11.15 | Saved report settings | ✅ |
| 11.16 | Reorder alerts on the dashboard | ✅ |
| 11.17 | Batch invoicing | ✅ |

## Delivered so far (2026-10-16)

### 11.1 Attachments
Shared `DocumentAttachments` on every sales document, every purchase document
(not only expenses), and manual journals. PDF / JPEG / PNG / WebP, 4 MB.
`LedgerFile` now has FKs to sales and purchase documents. Bank-feed attach stays
on the import screen.

### 11.7 Credit limit
Posting an **invoice** (not a draft, estimate, order, or cash receipt) is refused
when the customer's AR plus the new total would exceed `Customer.creditLimit`.
Drafts still save so the clerk can collect payment or raise the limit.

### 11.9 Change history
Sales and purchase detail pages show the audit events for that record (created /
changed / posted / …) with who and when.

### 11.3 Email a document
Share from the document screen already sends the invoice, statement, or purchase
order (`invoice:send`). The transport and template live with that share action.

### 11.4 Progress invoicing
Create invoice on an estimate, quotation, or sales order opens a quantity screen
(the same shape as receiving a purchase order). Each invoice bills what was
entered; the source stays open until nothing is left, then closes. Sales receipt
and sales order stay one-step converts.

### 11.5 Billable expenses
A category line on a bill or expense can name a customer and an optional charge.
`listBillableExpenses` feeds **Add billable expenses** on a new invoice, which
pulls the cost on once (`sourcePurchaseLineId`). A document already offset
against a customer cannot also be marked billable.

### 11.8 Automatically reversing journals
Manual journal form has **Reverse next period**. On post (or when a draft is
approved), a mirror journal is written dated the first day of the next accounting
period with reason “Automatic reversal”. Both rows stay on the ledger; balances
include REVERSED originals so October keeps the accrual and November cancels it.

### 11.9a Trash restore
Settings → Trash (`/settings/activity`, alias `/settings/trash`) lists soft-deleted
transactions with who, when, and why. Restore puts restorable kinds back;
deposits explain why they cannot. Clear Trash permanently purges. Journal detail
now also shows Change history (11.9).

### 11.10 Bank rules
Rules saved from the statement screen are listed under Banking → Rules. A rule
can be turned off or deleted. When two rules match, one tied to that bank wins
over one that applies to every bank, then name. A rule only fills the
suggestion. Posting the line is still a separate action.

### 11.11 Duplicate warnings
A bill whose vendor reference matches another live bill (same vendor, ignoring
case) is refused until the clerk confirms. A bill payment with the same vendor,
date, and amount, and a customer payment with the same customer, date, and
amount, work the same way. Confirming resubmits with the warning acknowledged.
Voided and deleted documents are ignored.

### 11.12 Classes
One optional class (`TrackingCategory`) under Settings → Classes. A sale or
purchase can name a class on the document; posting stamps it on every journal
line. A manual journal picks a class per line. Profit and Loss by Class groups
those lines (untagged lines are Unclassified). Not a separate location or project
dimension.

### 11.13 Item bundles
A GROUP item is sold as **one line** (kit price and income on the group). When
the invoice or sales receipt posts, stock of each inventory / assembly member
moves by kit qty × member qty, and COGS follows those costs. The group needs an
income account and at least one member. Assemblies inside a kit must still be
built first.

### 11.14 Customer price levels
A customer is Retail or Wholesale. An item may carry a wholesale price beside
the sales price. A wholesale customer is charged that price when it is set;
otherwise the sales price. The sales form applies it when an item is chosen and
when the customer changes on lines that still show the previous default. A
blank price on save follows the same rule. The till stays on the sales price.

### 11.15 Saved report settings
Every report that uses the period bar has **Save view**. Name the current URL
(period, basis, comparison, filters); it appears under Reports → Custom reports
and opens with those settings restored. Built on memorized `WorkspaceBookmark`
rows — no new table.

### 11.16 Reorder alerts on the dashboard
Home shows **To reorder (N)** when inventory is on and the user can read stock,
and at least one item is at or below its reorder point. Up to five names list
on-hand against the reorder point, and the heading opens the reorder report.
The block is omitted when nothing needs ordering.

### 11.17 Batch invoicing
Sales → Invoices → Invoice a batch (`/sales/batch`). Tick customers, pick one
item, date, quantity, and price. Each customer gets their own invoice.
Successes and failures (credit limit and the like) are listed together.
Needs `invoice:create`.

### 11.2 Recurring transactions
`RecurringTemplate` stores a named schedule (weekly / monthly / quarterly /
yearly) and a create payload for a journal, bill, or expense. List, new, and
edit live under Banking → Recurring. Occurrences are created on demand
(**Create now** / **Create due**) — nothing posts on a timer yet.
