# Progress

| Phase                       | Status                 | Notes                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Foundation & Identity   | ✅ Complete · deployed | 2026-08-28 · [detail](./phases/phase-01-foundation.md) · migration `20260828142957_init_foundation` · lint + typecheck + 46 tests + build green · Vercel build fixed, see [ADR-0009](./decisions/0009-build-must-not-need-secrets.md) |
| 2 — Accounting Core         | ✅ Complete            | 2026-08-28 · [detail](./phases/phase-02-accounting-core.md) · migrations `ledger_core`, `ledger_tenant_fks` · 10 integrity objects live · 88 tests                                                                                    |
| 3 — Master Data & Tax       | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-03-master-data.md) · migrations `master_data` ×2 · 15 integrity objects · 137 tests                                                                                                              |
| 4 — Sales / AR              | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-04-sales.md) · migration `sales` · 25 integrity objects · 173 tests                                                                                                                              |
| 5 — Purchases / AP          | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-05-purchases.md) · migration `purchases` · 35 integrity objects · 196 tests                                                                                                                      |
| 6 — Banking & Cash          | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-06-banking.md) · migration `banking` · 45 integrity objects · 212 tests                                                                                                                          |
| 7 — Inventory               | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-07-inventory.md) · migration `inventory` · 51 integrity objects · 226 tests                                                                                                                      |
| 8 — Reporting               | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-08-reporting.md) · no migration — reports read the ledger · 51 integrity objects · 272 tests · [ADR-0010](./decisions/0010-no-balance-rollup-table.md)                                          |
| 9 — Period Close & Year-End | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-09-period-close.md) · migration written, not yet applied · 56 integrity objects · [ADR-0011](./decisions/0011-closing-entries-excluded-from-the-profit-and-loss.md)                                |
| 10 — Interface & Hardening  | ✅ Complete            | 2026-09-01 · [detail](./phases/phase-10-hardening.md) · migrations `receiving`, `soft_delete` · [ADR-0012](./decisions/0012-owned-combobox-and-dialog.md), [ADR-0013](./decisions/0013-soft-delete-for-transactions.md) · 304 tests · 56 integrity objects · second pass 10.12–10.22; third pass 10.23–10.28: aging agrees with the ledger, whole-chart journals, one-verb Delete everywhere, partial receiving, transaction detail by account · not clicked through in a browser |
| 11 — The practical gaps     | 🚧 In progress         | Started 2026-10-16 · [detail](./phases/phase-11-practical-gaps.md) · [roadmap](./04-roadmap.md#phase-11--the-practical-gaps) · first task 11.1 Attachments |

Phases advance only on explicit instruction from the owner.

## Open items carried forward

| Item                                                                                  | Phase it lands in |
| ------------------------------------------------------------------------------------- | ----------------- |
| Email delivery for invitations (currently the inviter sets a temporary password)      | 10                |
| Multi-currency behaviour — the schema is already currency-aware                       | 10                |
| Rate limiting on the sign-in endpoint                                                 | 10                |
| An end-to-end test through `voidDocument` asserting `stockAgreesWithLedger`           | 10                |
| End-to-end browser tests — nothing in Phase 10 has been clicked through                | 10                |

## Third pass over Phase 10 — 2026-09-01

Four reported problems and one review, all inside Phase 10's remit. Detail in
[phase-10-hardening.md](./phases/phase-10-hardening.md), tasks 10.23–10.27.

One was a reporting defect that had been in the books since Phase 3 and is worth
knowing about on its own:

**The AR and AP aging reports did not agree with the control account, and could
not.** They were built from open invoices and bills; the control balance was read
from the journal lines. A customer opening balance posts straight to receivables
with no invoice behind it — so the very first customer entered with an opening
balance made the report disagree with the trial balance. The same was true of any
unapplied payment. The report noticed and said `agrees: false`, which is honest
but not useful. Both reports now read the control account broken down by
counterparty and put whatever no open document explains on that party's own row,
so the total *is* the control balance rather than being compared to it.

The other three were the interface refusing what the ledger permits: a manual
journal that hid a third of the chart of accounts, lists with no way to delete
anything, and a purchase order that could only be received in full.

**Delete took two attempts.** The first put the existing *void* control into the
row menus, which meant the application now declined to delete things in fifteen
more places. The owner asked for Delete, not for a third place to be told about
reversal, and he was right. What shipped is one verb — Delete — that actually
removes the transaction from every list, report and balance, while the row itself
stays in PostgreSQL unedited so what was once posted can still be reconstructed.
The reasoning, and what the database still refuses, is in
[ADR-0013](./decisions/0013-soft-delete-for-transactions.md).

A fifth item — a review of the system against QuickBooks — produced
[Phase 11](./04-roadmap.md#phase-11--the-practical-gaps), scoped and not started.

## Second pass over Phase 10 — 2026-08-31

Eleven areas reported as broken or missing, all of them inside Phase 10's remit
(interface and hardening) rather than a new phase. Detail in
[phase-10-hardening.md](./phases/phase-10-hardening.md), tasks 10.12–10.22.

Two were real accounting defects rather than interface problems, and both are
worth knowing about:

1. **Voiding or editing a document reversed its journal but not its stock**
   (10.13). The general ledger and the stock ledger then disagreed about what the
   business owned, and every edit of a bill inflated the stock further.
2. **A document carrying the same item twice costed both lines at the first
   line's amount** (10.13), so the second was received into stock at the wrong
   value.

Everything else was the interface refusing to let somebody do something the
ledger was perfectly happy with: no way to delete a draft, no way to undo a
transfer, no way to sell a tracked item, no way to pay a bill out of petty cash.
