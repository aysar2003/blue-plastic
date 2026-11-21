# Phase 3 — Master Data & Tax

**Status:** ✅ Complete — 2026-08-29
**Depends on:** Phase 2
**Blocks:** Phases 4, 5, 7

## Goal

The records that documents are made of: who is invoiced, who is paid, what is
sold, at what tax, on what terms. No documents yet — those are Phases 4 and 5.

## Tasks

| # | Task | Where | Status |
| --- | --- | --- | --- |
| 3.1 | Customers: addresses, terms, credit limit, opening balance | `server/services/contact.service.ts`, `app/(app)/customers/` | ✅ |
| 3.2 | Vendors: terms, tax id, default expense account, opening balance | same service, `app/(app)/vendors/` | ✅ |
| 3.3 | Items: service / non-inventory / inventory, with account mappings | `server/services/item.service.ts`, `app/(app)/items/` | ✅ |
| 3.4 | Tax agencies, rates, codes; compound and inclusive handling | `server/accounting/tax.ts`, `server/services/tax.service.ts`, `app/(app)/settings/tax/` | ✅ |
| 3.5 | Payment terms and due-date calculation | `lib/payment-terms.ts`, `app/(app)/settings/payment-terms/` | ✅ |
| 3.6 | List UX: search, filters, pagination, bulk archive, CSV import | `components/master-data/`, `lib/csv.ts`, `server/services/import.service.ts` | ✅ |
| 3.7 | Opening balances through AR/AP and Opening Balance Equity | `contact.service.ts` | ✅ |

## Data model delivered

`PaymentTerm`, `Customer`, `Vendor`, `ItemCategory`, `Item`, `TaxAgency`,
`TaxRate`, `TaxCode`, `TaxCodeRate`, plus the enums `ItemType`,
`PaymentTermType`, `TaxApplication`, `TaxFilingFrequency`.

Migrations: `20260828204409_master_data`, `20260828205456_master_data`.

Phase 2 created `journal_lines.customerId` / `.vendorId` without foreign keys,
because the tables did not exist yet. Phase 3 added them — composite, carrying
`orgId`, so a line cannot name another organisation's contact (R9).

## The tax model

A **rate** is one percentage owed to one agency. A **code** is what someone picks
on a document line, and combines one or more rates. That separation is what makes
compound and multi-jurisdiction tax expressible without a special case.

Two rules decide almost every argument about a tax figure, and both are in
`server/accounting/tax.ts`:

1. **Tax is computed per line, rounded per line, then summed.** Computing on the
   document total and back-allocating produces a total that disagrees with the
   printed invoice by a cent, which customers notice. A test pins this: three
   lines of 33.33 at 16% sum to 15.99, where the shortcut would say 16.00.
2. **A compound rate is charged on the running total**, including the rates before
   it — so a code's components carry a sequence, and changing the order changes
   the answer. Also pinned by a test.

Rates are stored as fractions (0.15, not 15) at nine decimal places, so a
third-of-a-percent levy survives the arithmetic. A `CHECK` refuses anything
outside 0..1: entering 16 where 0.16 was meant is the single most likely tax bug
there is, and it makes every invoice wrong by a factor of a hundred.

Inclusive pricing extracts the tax from the price rather than adding to it, and a
property test asserts the thing that actually matters — net + tax always equals
the price the customer was quoted.

## Item account mappings

Posting is driven by master data rather than by whoever is typing the invoice.
Which mappings an item needs depends on its type, and the rule is enforced in the
service (which can name the field) and by a trigger (which is the guarantee):

| Type | Required | Behaviour |
| --- | --- | --- |
| `SERVICE` | income | — |
| `NON_INVENTORY` | income | expense account optional |
| `INVENTORY` | income + inventory asset + COGS | selling one will move stock and post cost in the same journal as the sale (Phase 7) |

Each mapping must also point at an account of the right *kind*. An inventory item
with no COGS account would sell at full margin; one whose "income" account is an
expense would invert the profit and loss. Neither is expressible.

An item's **type cannot be changed** once it exists — it would reclassify every
document that already used it.

## Opening balances

A customer's opening balance is a journal, never a column:

```
Customer:  Dr Accounts Receivable (carrying the customer)   Cr Opening Balance Equity
Vendor:    Dr Opening Balance Equity                        Cr Accounts Payable (carrying the vendor)
```

Because the control-account line carries its counterparty (R7), the aging report
and the control account are the same rows read two ways. There is no separate
balance to reconcile and no reconciliation job to forget.

## CSV import

Customers and vendors can be imported from a spreadsheet export. Three decisions
worth recording:

- **Preview first, always.** A file of customers is exactly the kind of thing
  nobody checks afterwards, so the flow says what will happen, what will be
  skipped and why, before anything is written.
- **Existing names are skipped, never merged.** Guessing that two similar names
  are the same person is how a subledger ends up with two balances for one
  customer.
- **Headers are matched loosely** — case, spaces and underscores are noise, so
  "Display Name", `display_name` and `DisplayName` are the same column.

The parser is ~60 lines rather than a dependency: the whole surface is quoted
fields, escaped quotes, embedded newlines and Excel's byte-order mark, and each is
covered by a test.

## A hazard found and fixed: Prisma drops what it cannot model

Running `prisma migrate dev` for this phase **silently generated a migration that
dropped the composite tenancy foreign keys** added in Phase 2. Prisma does not
model them, so it reads them as drift.

That is not a Prisma bug — it is the cost of expressing rules it has no vocabulary
for — but it means a routine migration can quietly take the ledger's guarantees
away. The fix has three parts:

1. `pnpm db:harden` re-applies every file in `prisma/sql/`. All of them are
   idempotent (`DROP … IF EXISTS`, `CREATE OR REPLACE`).
2. `db:migrate` and `db:deploy` now run it automatically afterwards.
3. `pnpm db:verify` fails loudly if any of the 15 objects is missing.

**Anyone adding a migration must keep this chain intact.** Use `pnpm db:migrate`,
never bare `prisma migrate dev`, and check `pnpm db:verify` afterwards.

## Verification

`pnpm verify` — lint clean, typecheck clean, **137 tests**. `pnpm build` clean —
26 routes. `pnpm db:verify` — all 15 integrity objects present.

| Area | Covered |
| --- | --- |
| Due dates (10) | net days from the document date, day-of-month rollover, February clamping, leap years, discount dates |
| Tax (15) | exclusive, inclusive, compound, sequence-dependence, per-line rounding, precision below a cent, document grouping by rate |
| CSV (11) | quoted commas, escaped quotes, embedded newlines, BOM, CRLF, short rows, blank lines, loose header matching |
| Opening balances (3) | customer into AR, vendor into AP, both leaving the trial balance in balance; a receivables line with no customer still refused |
| Tenancy (3) | a line naming another organisation's customer or vendor is refused by the composite FK; a contact named by a posted line cannot be deleted |
| Item mappings (4) | wrong account type refused, tracked item without all three refused, correct mapping accepted, non-inventory account refused |
| Tax storage (2) | a percentage stored where a fraction belongs is refused; precision below a cent survives |
| Payment terms (1) | only one default per organisation |

## What Phase 3 deliberately does not do

- No invoices, bills or payments — Phases 4 and 5. Tax is defined but nothing
  applies it yet.
- No stock movement or valuation — Phase 7. Inventory items declare their accounts;
  nothing moves through them.
## Wave A deepen — extra ship-to (2026-11-21)

Customers keep the default shipping fields and can add extra `CustomerAddress`
rows (warehouse, villa, job site). The sales document form picks a ship-to and
fills `workSite`.

Migration: `20261121180000_wave_a_landed_cost_ship_to` (apply with `pnpm db:deploy`).
