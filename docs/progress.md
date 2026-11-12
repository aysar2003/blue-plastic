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
| 22 — Platform + AI surface  | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-22-platform-ai.md) · [layers](./06-erp-layers.md) · API keys, OpenAPI, capabilities, MCP mirror · [ADR-0014](./decisions/0014-machine-api-single-service.md) |
| 23 — Hard 3-way match       | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-23-three-way-match.md) · MATCH_HOLD + variance approve · migration `20261105200000_phase23_three_way_match` |
| 24 — Lot / serial           | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-24-lot-serial.md) · receive/issue lots & serials · stock by lot · migration `20261105210000_phase24_lot_serial` |
| 25 — Project profitability  | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-25-project-profitability.md) · job P&L from sales, purchases, COGS, timesheets |
| 26 — Report packs           | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-26-report-packs.md) · scheduled packs · migration `20261105220000_phase26_report_packs` |
| 27 — Statutory payroll+VAT  | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-27-statutory.md) · payroll CSV/JSON + one-jurisdiction VAT return |
| 28 — Manufacturing WOs      | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-28-work-orders.md) · SME work orders → assembly posting |
| 29 — WMS picks post stock   | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-29-wms-picks.md) · pick completion issues inventory |
| 30 — SME BI dashboards      | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-30-dashboards.md) · KPI/report tiles · migration `20261105230000_phase28_30_work_orders_wms_dashboards` |
| 31 — WMS enterprise         | ✅ Complete            | 2026-11-06 · [detail](./phases/phase-31-wms-enterprise.md) · bin qty + putaway + waves |
| 32 — BI enterprise          | ✅ Complete            | 2026-11-06 · [detail](./phases/phase-32-bi-enterprise.md) · metric snapshots + pack email harden |
| 33 — Close enterprise UX    | ✅ Complete            | 2026-11-06 · [detail](./phases/phase-33-close-enterprise.md) · close pack + hard gates · migration `20261106200000_phase31_33_wms_bi_close` |
| 34 — Industry pack framework | ✅ Framework complete | 2026-11-07 · [detail](./phases/phase-34-industry-packs.md) · 16 packs, installPack, Help Coverage, migration `20261107220000_phase34_industry_packs` |
| Hospitality ERP (restaurant + hotel) | ✅ Complete | 2026-11-07 · [detail](./phases/phase-hospitality-erp.md) · tables, tips, night audit, kitchen link; rooms/folio→invoice · migration `20261107230000_phase_hospitality` |
| P2–P5 institution verticals | ✅ Complete | 2026-11-08 · pharmacy, school/university, hospital billing, NGO/services/construction/mfg/distribution |
| P6 Coverage gate + P7 Wizard | ✅ Complete | 2026-11-08 · [detail](./phases/phase-p6-p7-onboarding.md) · all packs ready · `/onboarding` · Settings Setup · migration `20261108120000_phase_p6_p7_onboarding` |
| P8–P11 Vertical lite → full | ✅ Complete | 2026-11-08 · [detail](./phases/phase-p8-p11-vertical-full.md) · ASN receive, WIP bill, retention GL, work-center capacity · migration `20261108130000_phase_p8_p11_vertical_full` |
| Platform polish + vertical deepen | ✅ Complete | 2026-11-10 · [detail](./phases/phase-platform-polish-deepen.md) · Apps Grant-to-all · pharmacy/education/hospital/NGO/WIP/progress/ASN/routing/hospitality deepen |
| Lite vertical close Pass 1 | ✅ Complete | 2026-11-11 · [detail](./phases/phase-lite-close-pass1.md) · tip payout, nightly folio, lot disposal, term batch bill, claim stamp, fund BS, WIP write-up/down, site store, weekday capacity, ASN dock, price lists/promos · migration `20261111120000_phase_lite_close_pass1` |
| 35 — Multi-entity & IC harden | ✅ Complete | 2026-11-11 · [detail](./phases/phase-35-multi-entity.md) · ownership %, IntercompanyMatch, group close checklist, consol NCI · migration `20261111140000_phase35_multi_entity` |
| 36 — Subscriptions & recurring revenue | ✅ Complete | 2026-11-11 · [detail](./phases/phase-36-subscriptions.md) · AR INVOICE schedules, Unearned Revenue, deferred recognition · migration `20261111220000_phase36_subscriptions` |

Phases advance only on explicit instruction from the owner.

**SME loops 1–21, layer waves 22–30, and enterprise WMS/BI/close 31–33 are complete.** Remaining non-goals: hardware, trademarks, untrusted plugins.

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
