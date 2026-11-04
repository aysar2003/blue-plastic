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
| 11 — The practical gaps     | ✅ Complete            | Started 2026-10-16 · finished 2026-11-01 · [detail](./phases/phase-11-practical-gaps.md) · [roadmap](./04-roadmap.md#phase-11--the-practical-gaps) · 11.1–11.17 done |
| 12 — Depth (Wave B)         | ✅ Complete            | Started/finished 2026-11-01 · [detail](./phases/phase-12-depth.md) · FX day-to-day, credit warn, timesheets, POS/KPI/equity lite; HRIS suite deferred |
| 13 — Ledger depth           | ✅ Complete            | 2026-11-02 · [detail](./phases/phase-13-ledger-depth.md) · fixed assets, FX open AR/AP, rate limit, invite email |
| 14 — Equity & groups lite   | ✅ Complete            | 2026-11-02 · [detail](./phases/phase-14-equity.md) · shareholders, equity events, owners equity statement |
| 15 — HRIS lite              | ✅ Complete            | 2026-11-02 · [detail](./phases/phase-15-hris.md) · lifecycle, recruitment, appraisals |
| 16 — Collab apps lite       | ✅ Complete            | 2026-11-02 · [detail](./phases/phase-16-collab.md) · Sign, Appointments, Discuss, Planning, Surveys |
| 17 — Insight & SME close    | ✅ Complete            | 2026-11-02 · [detail](./phases/phase-17-insight.md) · KPI pins, cycle smoke doc, roadmap |
| 18 — Lite → ERP depth       | ✅ Complete            | 2026-11-04 · [detail](./phases/phase-18-erp-depth.md) · Sign token, ATS stages, CRM pipeline, BOM explode, cap table, group BS |
| 19 — Remaining gaps         | ✅ Complete            | 2026-11-04 · [detail](./phases/phase-19-full-erp.md) · MRP page, sign email, notify gateway, tickets, home KPIs, IC journals, backup extras |
| 20 — Operating close        | ✅ Complete            | 2026-11-04 · [detail](./phases/phase-20-operating-close.md) · backup restore extras, portal quotes, appointment types |
| 21 — Legal layers           | ✅ Complete            | 2026-11-04 · [detail](./phases/phase-21-legal-layers.md) · hedge docs, kitchen display, first-party marketplace, bins/picks, sign certificate, training, payroll backup |

Phases advance only on explicit instruction from the owner.

**SME ERP operating loops (phases 1–21) are complete.** Remaining non-goals are hardware, trademarks, and untrusted third-party code.

## Open items carried forward

| Item                                                                                  | Phase it lands in |
| ------------------------------------------------------------------------------------- | ----------------- |
| Qualified eIDAS / DocuSign trademark, untrusted plugins, robot/PLC, IoT printers      | out               |
| Browser Playwright suite beyond documented vitest cycle smoke                         | optional          |

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
