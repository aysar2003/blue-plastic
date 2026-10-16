# Phase 11 — The practical gaps

**Status:** 🚧 In progress — started 2026-10-16
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
| 11.2 | Recurring transactions (template + schedule) | TBD | ⛔ |
| 11.3 | Email a document (invoice, statement, PO) | `invoice:send`, transport + template | ⛔ |
| 11.4 | Progress invoicing from an estimate | Sales convert / estimate balance | ⛔ |
| 11.5 | Billable expenses → pull onto next invoice | Purchase lines + sales | ⛔ |
| 11.6 | Aged detail reports (per document) | AR/AP aging | ⛔ |

### 11b — Control and correctness

| # | Task | Where | Status |
| --- | --- | --- | --- |
| 11.7 | Enforce customer credit limit | `sales.service` create/update on posted invoices | ✅ |
| 11.8 | Automatically reversing journals | Journal + period open | ⛔ |
| 11.9 | Per-document change history | `DocumentHistory` on sales & purchase detail | ✅ |
| 11.9a | Recently deleted / restore (Trash already covers list; polish restore) | Trash | partial |
| 11.10 | Bank rules for categorising imports | Banking import | ⛔ |
| 11.11 | Duplicate warnings (bill ref, same-day payment) | Purchase / payment entry | ⛔ |

### 11c — Lower cost of omission

| # | Task | Status |
| --- | --- | --- |
| 11.12 | Classes / locations | ⛔ |
| 11.13 | Item bundles | ⛔ |
| 11.14 | Customer price levels | ⛔ |
| 11.15 | Saved report settings | ⛔ |
| 11.16 | Reorder alerts on the dashboard | ⛔ |
| 11.17 | Batch invoicing | ⛔ (largely covered by 11.2) |

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
