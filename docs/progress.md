# Progress

| Phase                       | Status                 | Notes                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Foundation & Identity   | ✅ Complete · deployed | 2026-08-28 · [detail](./phases/phase-01-foundation.md) · migration `20260828142957_init_foundation` · lint + typecheck + 46 tests + build green · Vercel build fixed, see [ADR-0009](./decisions/0009-build-must-not-need-secrets.md) |
| 2 — Accounting Core         | ✅ Complete            | 2026-08-28 · [detail](./phases/phase-02-accounting-core.md) · migrations `ledger_core`, `ledger_tenant_fks` · 10 integrity objects live · 88 tests                                                                                    |
| 3 — Master Data & Tax       | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-03-master-data.md) · extra ship-to 2026-11-21 · `CustomerAddress` + sales ship-to picker · migration `20261121180000_wave_a_landed_cost_ship_to`                                                                 |
| 4 — Sales / AR              | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-04-sales.md) · migration `sales` · 25 integrity objects · 173 tests                                                                                                                              |
| 5 — Purchases / AP          | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-05-purchases.md) · migration `purchases` · 35 integrity objects · 196 tests                                                                                                                      |
| 6 — Banking & Cash          | ✅ Complete (FULL)     | 2026-08-29 · statement packs Wave C 2026-11-21 · [detail](./phases/phase-06-banking.md) · SO/KE CSV column presets · migration `20261121191000_wave_c_deepen`                                                                         |
| 7 — Inventory               | ✅ Complete (FULL)     | 2026-08-29 · landed cost 2026-11-21 · [detail](./phases/phase-07-inventory.md) · freight/duty bill → WA cost · migration `20261121180000_wave_a_landed_cost_ship_to`                                                                  |
| 8 — Reporting               | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-08-reporting.md) · no migration — reports read the ledger · 51 integrity objects · 272 tests · [ADR-0010](./decisions/0010-no-balance-rollup-table.md)                                          |
| 9 — Period Close & Year-End | ✅ Complete            | 2026-08-29 · [detail](./phases/phase-09-period-close.md) · migration written, not yet applied · 56 integrity objects · [ADR-0011](./decisions/0011-closing-entries-excluded-from-the-profit-and-loss.md)                                |
| 10 — Interface & Hardening  | ✅ Complete (FULL)     | 2026-09-01 · Wave F 2026-11-21 Playwright cycle smoke sell→pay→buy→stock→recon→close (`e2e/cycle-smoke.spec.ts`, skip without E2E credentials) · [detail](./phases/phase-10-hardening.md) · migrations `receiving`, `soft_delete` · [ADR-0012](./decisions/0012-owned-combobox-and-dialog.md), [ADR-0013](./decisions/0013-soft-delete-for-transactions.md) |
| 11 — The practical gaps     | ✅ Complete            | Started 2026-10-16 · finished 2026-11-01 · [detail](./phases/phase-11-practical-gaps.md) · [roadmap](./04-roadmap.md#phase-11--the-practical-gaps) · 11.1–11.17 done |
| 12 — Depth (Wave B)         | ✅ Complete            | Started/finished 2026-11-01 · [detail](./phases/phase-12-depth.md) · FX day-to-day, credit warn, timesheets, POS/KPI/equity lite; HRIS suite deferred · Wave A 2026-11-21 till close expected vs counted, payouts, session P&L, reprint last |
| 13 — Ledger depth           | ✅ Complete (FULL)     | 2026-11-02 · Wave C 2026-11-21 payment-date FX rate + realised gain/loss · [detail](./phases/phase-13-ledger-depth.md) · `FxDailyRate` · migration `20261121191000_wave_c_deepen` |
| 14 — Equity & groups lite   | ✅ Complete (FULL)     | 2026-11-02 · Wave D 2026-11-21 CSV register + period movement; events hit statement accounts · [detail](./phases/phase-14-equity.md) |
| 15 — HRIS                   | ✅ Complete (FULL)     | 2026-11-02 · Wave C 2026-11-21 hire→contract+wage, hours CSV, pack payroll CSV · [detail](./phases/phase-15-hris.md) · migration `20261121191000_wave_c_deepen` |
| 16 — Collab apps            | ✅ Complete (FULL)     | 2026-11-02 · Wave C 2026-11-21 sign→doc, appointment job/project + overlap, planning→timesheet · [detail](./phases/phase-16-collab.md) · migration `20261121191000_wave_c_deepen` |
| 17 — Insight & SME close    | ✅ Complete            | 2026-11-02 · [detail](./phases/phase-17-insight.md) · KPI pins, cycle smoke doc, roadmap |
| 18 — Lite → ERP depth       | ✅ Complete            | 2026-11-04 · [detail](./phases/phase-18-erp-depth.md) · Sign token, ATS stages, CRM pipeline, BOM explode, cap table, group BS |
| 19 — Remaining gaps         | ✅ Complete            | 2026-11-04 · [detail](./phases/phase-19-full-erp.md) · MRP page, sign email, notify gateway, tickets, home KPIs, IC journals, backup extras |
| 20 — Operating close        | ✅ Complete            | 2026-11-04 · [detail](./phases/phase-20-operating-close.md) · backup restore extras, portal quotes, appointment types · Wave A 2026-11-21 portal bank instructions + payment-proof upload |
| 21 — Legal layers           | ✅ Complete            | 2026-11-04 · [detail](./phases/phase-21-legal-layers.md) · hedge docs, kitchen display, first-party marketplace, bins/picks, sign certificate, training, payroll backup |
| 22 — Platform + AI surface  | ✅ Complete (FULL)     | 2026-11-05 · Wave F 2026-11-21 invoices.list/create, payment.create, stock.onHand, serviceJobs.get/complete · [detail](./phases/phase-22-platform-ai.md) · [layers](./06-erp-layers.md) · API keys, OpenAPI, capabilities, MCP mirror · [ADR-0014](./decisions/0014-machine-api-single-service.md) |
| 23 — Hard 3-way match       | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-23-three-way-match.md) · MATCH_HOLD + variance approve · migration `20261105200000_phase23_three_way_match` |
| 24 — Lot / serial           | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-24-lot-serial.md) · receive/issue lots & serials · stock by lot · migration `20261105210000_phase24_lot_serial` |
| 25 — Project profitability  | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-25-project-profitability.md) · job P&L from sales, purchases, COGS, timesheets |
| 26 — Report packs           | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-26-report-packs.md) · scheduled packs · migration `20261105220000_phase26_report_packs` |
| 27 — Statutory payroll+VAT  | ✅ Toward FULL         | 2026-11-05 · [detail](./phases/phase-27-statutory.md) · pack payroll CSV + VAT boxes 1–5 with pack labels (UI/CSV/JSON) · Wave A 2026-11-21 |
| 28 — Manufacturing WOs      | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-28-work-orders.md) · SME work orders → assembly posting |
| 29 — WMS picks post stock   | ✅ Complete            | 2026-11-05 · [detail](./phases/phase-29-wms-picks.md) · pick completion issues inventory |
| 30 — SME BI dashboards      | ✅ Complete (FULL)     | 2026-11-05 · Wave D 2026-11-21 snapshot pulse stock/open jobs/van stock · [detail](./phases/phase-30-dashboards.md) · KPI/report tiles · migration `20261105230000_phase28_30_work_orders_wms_dashboards` |
| 31 — WMS enterprise         | ✅ Complete            | 2026-11-06 · [detail](./phases/phase-31-wms-enterprise.md) · bin qty + putaway + waves |
| 32 — BI enterprise          | ✅ Complete (FULL)     | 2026-11-06 · Wave D 2026-11-21 snapshot keys stockValue/openJobs/vanStock · [detail](./phases/phase-32-bi-enterprise.md) · metric snapshots + pack email harden |
| 33 — Close enterprise UX    | ✅ Complete (FULL)     | 2026-11-06 · Wave D 2026-11-21 optional second approver on hard-gate close · [detail](./phases/phase-33-close-enterprise.md) · close pack + hard gates · migration `20261121200000_wave_d_deepen` |
| 34 — Industry pack framework | ✅ Framework complete | 2026-11-07 · [detail](./phases/phase-34-industry-packs.md) · 16 packs, installPack, Help Coverage, migration `20261107220000_phase34_industry_packs` |
| Hospitality ERP (restaurant + hotel) | ✅ Complete | 2026-11-07 · [detail](./phases/phase-hospitality-erp.md) · tables, tips, night audit, kitchen link; rooms/folio→invoice · migration `20261107230000_phase_hospitality` |
| P2–P5 institution verticals | ✅ Complete | 2026-11-08 · pharmacy, school/university, hospital billing, NGO/services/construction/mfg/distribution |
| P6 Coverage gate + P7 Wizard | ✅ Complete | 2026-11-08 · [detail](./phases/phase-p6-p7-onboarding.md) · all packs ready · `/onboarding` · Settings Setup · migration `20261108120000_phase_p6_p7_onboarding` |
| P8–P11 Vertical lite → full | ✅ Complete | 2026-11-08 · [detail](./phases/phase-p8-p11-vertical-full.md) · ASN receive, WIP bill, retention GL, work-center capacity · migration `20261108130000_phase_p8_p11_vertical_full` |
| Platform polish + vertical deepen | ✅ Complete | 2026-11-10 · [detail](./phases/phase-platform-polish-deepen.md) · Apps Grant-to-all · pharmacy/education/hospital/NGO/WIP/progress/ASN/routing/hospitality deepen |
| Lite vertical close Pass 1 | ✅ Complete | 2026-11-11 · [detail](./phases/phase-lite-close-pass1.md) · tip payout, nightly folio, lot disposal, term batch bill, claim stamp, fund BS, WIP write-up/down, site store, weekday capacity, ASN dock, price lists/promos · migration `20261111120000_phase_lite_close_pass1` |
| 35 — Multi-entity & IC harden | ✅ Complete (FULL) | 2026-11-11 · Wave D 2026-11-21 confirm match posts elim memo journal pair · [detail](./phases/phase-35-multi-entity.md) · ownership %, IntercompanyMatch, group close checklist, consol NCI · migration `20261121200000_wave_d_deepen` |
| 36 — Subscriptions & recurring revenue | ✅ Complete (FULL) | 2026-11-11 · Wave C 2026-11-21 dunning + reminder, pause/cancel clears unearned, portal upcoming · [detail](./phases/phase-36-subscriptions.md) · migration `20261111220000_phase36_subscriptions` |
| 37 — Service jobs | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-37-service-jobs.md) · site + window, van replenish draft, tech day list, cancel restores van · migration `20261121181000_wave_a_deepen` |
| 38 — Sales contracts | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-38-contracts.md) · billed vs remaining, retainage on milestones, change-order amount · migration `20261121181000_wave_a_deepen` |
| 39 — CAPA | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-39-capa.md) · owner/due/root cause/effectiveness + vendor/lot + CSV · migration `20261121190000_wave_b_deepen` |
| 40 — Localization packs | ✅ Toward FULL | 2026-11-14 · [detail](./phases/phase-40-localization.md) · SO/KE/ET/DJ packs: payroll CSV, tax seed, VAT box map, e-invoice JSON (lines/tax/addresses) · Wave A deepen 2026-11-21 · no Peppol · migration `20261114180000_phase37_40_wave_a` |
| 41 — Retail replenishment | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-41-retail.md) · item×store min/max, price-list date windows, post drafts · migration `20261121181000_wave_a_deepen` |
| 42 — Menu food-cost | ✅ Complete (FULL) | 2026-11-21 · Wave E period food-cost % + recipe vs actual · [detail](./phases/phase-42-menu-food.md) · migration `20261121201000_wave_e_deepen` |
| 43 — Construction budget | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-43-construction-budget.md) · SOV lines + site-store issues on progress · migration `20261121190000_wave_b_deepen` |
| 44 — Mfg capacity overload | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-44-manufacturing-capacity.md) · work-center holiday exceptions zero capacity · migration `20261121190000_wave_b_deepen` |
| 45 — Distribution bins/waves | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-45-distribution-bins.md) · ASN dock calendar, packing CSV, ASN vs PO discrepancy · migration `20261121190000_wave_b_deepen` |
| 46 — Retainer remaining | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-46-retainer-remaining.md) · utilization hours, WIP aging, replenish unearned invoice |
| 47 — NGO fund restrict | ✅ Complete (FULL) | 2026-11-21 · Wave E grant BvA by class + pledge receipt note + donor CSV · [detail](./phases/phase-47-ngo-fund-restrict.md) · migration `20261121201000_wave_e_deepen` |
| 48 — Scholarship summary | ✅ Complete (FULL) | 2026-11-21 · Wave E award → fee-waiver line on term invoice · [detail](./phases/phase-48-education-scholarship.md) |
| 48b — School SIS deepen | ✅ Complete (FULL) | 2026-11-22 · Classes, roster, attendance, grades, report cards + portal · [detail](./phases/phase-48b-school-sis-deepen.md) · migration `20261122140000_school_sis_deepen` |
| 49 — Hospital claims batch | ✅ Complete (FULL) | 2026-11-21 · Wave E claim submitted/paid/denied + remittance to visit AR · [detail](./phases/phase-49-hospital-claims-batch.md) · migration `20261121201000_wave_e_deepen` |
| 50 — Agriculture pack | ✅ Complete (FULL) | 2026-11-21 · Wave E season = project/class filter on seasonal cost · [detail](./phases/phase-50-agriculture.md) · migration `20261121201000_wave_e_deepen` |
| 51 — Franchise | ✅ Complete (FULL) | 2026-11-14 · Wave D 2026-11-21 royalty statement CSV + brand P&L · [detail](./phases/phase-51-franchise.md) · catalog push + royalty accrual · migration `20261121200000_wave_d_deepen` |
| 52 — Holding portfolio | ✅ Complete (FULL) | 2026-11-14 · Wave D 2026-11-21 cash/AR/stock/NI at ownership % + YoY · [detail](./phases/phase-52-portfolio.md) · rolled NI + NCI CSV · migration `20261121200000_wave_d_deepen` |
| 53 — Commitments vs budget | ✅ Complete (FULL) | 2026-11-21 · [detail](./phases/phase-53-commitments.md) · remaining = budget − encumbered − actual; de-encumber on bill/cancel |
| 54 — Cooperative patronage | ✅ Complete (FULL) | 2026-11-21 · Wave E patronage from purchases → equity event + member CSV · [detail](./phases/phase-54-cooperative.md) · migration `20261121201000_wave_e_deepen` |
| 55 — Scale ops | ✅ Complete (FULL) | 2026-11-14 · Wave F 2026-11-21 periods checklist: live-year window, archive closed year, report-pack warning · [detail](./phases/phase-55-scale.md) |
| 56 — Marketplace settlement | ✅ Complete (FULL) | 2026-11-21 · Wave E seller statement + settle → vendor bill/payment · [detail](./phases/phase-56-marketplace-settlement.md) · migration `20261121201000_wave_e_deepen` |
| 57 — Banking loans | ✅ Complete (FULL) | 2026-11-14 · Wave C 2026-11-21 disbursement, overdue aging, interest accrue once · [detail](./phases/phase-57-banking-loans.md) · migration `20261121191000_wave_c_deepen` |
| 58 — Insurance policies | ✅ Complete (FULL) | 2026-11-14 · Wave C 2026-11-21 coverStart/coverEnd + InsuranceClaim register · [detail](./phases/phase-58-insurance.md) · migration `20261121191000_wave_c_deepen` |
| 59 — Sign provider webhook | ✅ Complete (FULL) | 2026-11-14 · Wave F 2026-11-21 inbound HMAC `/api/webhooks/sign` → signed/declined + `SignWebhookEvent` retry log · [detail](./phases/phase-59-sign-provider.md) · migration `20261121202000_wave_f_deepen` |
| 60 — Trusted extensions | ✅ Complete (FULL) | 2026-11-14 · Wave F 2026-11-21 org allowlist UI + `/settings/extensions` probe + `GET /api/v1/extensions/probe` · [detail](./phases/phase-60-trusted-extensions.md) |
| Budget deep-complete | ✅ Complete | 2026-11-15 · [detail](./phases/phase-budget-deep.md) · monthly/class/approve/copy/CSV/BvA/BS/control · migration `20261115140000_budget_deep` |
| Depth — CRM / portal / MRP / API | ✅ Complete | 2026-11-21 · [detail](./phases/phase-depth-crm-portal-mrp-api.md) · portal quote accept/decline · Won→draft estimate · MRP open demand · API +4 capabilities |

**LITE deepen pass (Wave A–D stubs → SME depth)** — 2026-11-15 · migration `20261115120000_lite_deepen` · phases 37–40, 51, 56–60 · `tests/lite-deepen.test.ts`.

**Vertical + locale + master-data deepen** — 2026-11-15 · Wave B 41–50 second pass (replenish post/FEFO/claims/CSV/encumbrance/menu margin/capacity/waves/retainer/agriculture) · localization tax seeds + richer e-invoice/VAT · Setup Fix Hub heals (SKU, reorder, country) · `tests/localization-packs`, `tests/setup-heal`, `tests/wave-b-41-50`, pharmacy/hospital suites.

**Wave A deepen (landed cost / ship-to / heal FULL)** — 2026-11-21 · landed cost allocate freight onto WA · extra customer ship-to · heal report CSV + pack tax on items without overwriting clerk reorder · migration `20261121180000_wave_a_landed_cost_ship_to` (needs `pnpm db:deploy`) · `tests/landed-cost`, `tests/setup-heal`.

**Wave B deepen (warehouse / site / quality / projects money)** — 2026-11-21 · ASN dock calendar + packing CSV + ASN vs PO discrepancy · SOV lines + site-store issues on progress · utilization hours + WIP aging + retainer replenish (unearned) · CAPA owner/due/root cause/effectiveness + CSV · remaining = budget − encumbered − actual and de-encumber on bill/cancel · work-center holiday exceptions · migration `20261121190000_wave_b_deepen` (needs `pnpm db:deploy`) · `tests/wave-b-deepen`.

**Wave C deepen (people / FX / credit / risk)** — 2026-11-21 · HRIS hire wage sync + hours CSV + pack payroll CSV · Sign attaches to sales/purchase docs · appointments link project/job and refuse overlap · planning hours → timesheet stub · FX payment-date rate + realised gain/loss · loan disbursement/aging/accrue · insurance cover dates + claims · subscription dunning/pause/cancel unearned · SO/KE statement import packs · migration `20261121191000_wave_c_deepen` (needs `pnpm db:deploy`) · `tests/wave-c-deepen`.

**Wave E deepen (adjacent verticals)** — 2026-11-21 · period food-cost % · grant BvA by class + pledge receipt + donor CSV · season project/class on farm lots · marketplace seller statement + vendor bill/payment · patronage equity events + member CSV · scholarship fee-waiver invoice line · hospital claim submitted/paid/denied + remittance to visit AR · migration `20261121201000_wave_e_deepen` (needs `pnpm db:deploy`) · `tests/wave-e-deepen`.

**Wave D deepen (group books)** — 2026-11-21 · IC confirm match posts elimination memo journal pair · equity register + period movement CSV; events hit statement accounts · portfolio KPI strip (cash/AR/stock/NI at ownership %, YoY) · franchise royalty statement + brand P&L · optional second approver on hard-gate period close · snapshot metrics stock value / open jobs / van stock · migration `20261121200000_wave_d_deepen` (needs `pnpm db:deploy`) · `tests/wave-d-deepen`.

**Wave F deepen (platform / proof / adapters)** — 2026-11-21 · Playwright cycle smoke sell→pay→buy→stock→recon→close · trading caps invoices.list/create, payments, stock on hand, serviceJobs.get/complete · inbound sign HMAC webhook + SignWebhookEvent retry log · org extension allowlist UI + capability probe · periods scale checklist (live-year window, archive link, report-pack warning) · duplicate `20261119200000_*` migrations left as already applied (do not rename) · migration `20261121202000_wave_f_deepen` (needs `pnpm db:deploy`) · `tests/wave-f-deepen`.

Phases advance only on explicit instruction from the owner.

**SME loops 1–21, layer waves 22–30, and enterprise WMS/BI/close 31–33 are complete.** Remaining non-goals: hardware, trademarks, untrusted plugins.

## Open items carried forward

| Item                                                                                  | Phase it lands in |
| ------------------------------------------------------------------------------------- | ----------------- |
| Qualified eIDAS / DocuSign trademark, untrusted plugins, robot/PLC, IoT printers      | out               |
| Browser Playwright suite beyond `e2e/cycle-smoke.spec.ts` (credentials optional)     | optional          |

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
