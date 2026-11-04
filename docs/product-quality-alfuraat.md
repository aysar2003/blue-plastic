# SOM ERP — quality map (AL FURAAT review)

Date: 2026-11-04. Company under test: **AL FURAAT GROUP OF COMPANY**.

## Verdict

**Usable for daily trading (sell → collect → buy → stock → bank → close)** after SME phases 1–17.  
**Easy-use: improving, not yet “anyone can open it cold.”** Apps rail is dense; team path on Home helps.  
**Customer trust:** real correctness bugs existed (Home AR vs Sales); data mistakes (country US) hurt letterhead. Those are being fixed in this pass.

This is **not** Odoo Enterprise / QBO Advanced / SAP. It is a **full SME ERP** for trading: books, stock, CRM, people, collab, MRP, tickets.

---

## What the system CAN do (team jobs)

| Job | Apps | Notes |
| --- | --- | --- |
| Sell | Sales, POS, Customers, Portal | Invoices, estimates, orders, receipts, delivery, credit memos; customers open quotes in the portal |
| Collect | Payments, Banking | Receive payment, undeposited → deposit, bank import |
| Buy | Purchases, Vendors, Bill payments | Bills, expenses, PO, RFQ, receiving |
| Stock | Inventory, Store, Barcodes | On hand, adjust, assemblies, MRP explode, reorder alerts |
| Books | Accounting, Journals, Reports, Periods | CoA, TB/P&L/BS, aging, budgets, FX reval, fixed assets, equity, group consolidation, [IC] journals |
| People | Employees, Recruitment | Directory, leave, payroll, ATS pipeline, appraisals, onboarding to-do |
| CRM | Customers → Pipeline / Tickets | Opportunities, follow-ups, support tickets |
| Collab (opt-in) | Sign, Appointments, Discuss, Planning, Surveys | Signing links + email, threads, overlap booking, named appointment types |
| Admin | Settings, Users, Approvals, Help | Roles, modules, SMTP, trash, backup restore of books **and** people/collab/CRM, guides EN/SO |

## What it CANNOT / will not (honest)

| Area | Status |
| --- | --- |
| FX dealing desk / ISDA | Out — hedge *documentation* + MTM is in |
| IoT kitchen printers | Out — kitchen display is in |
| Third-party app plugins | Out — first-party marketplace is in |
| WMS robotics | Out — bins/picks for people are in |
| DocuSign / Slack trademarks | Out — sign certificate + Discuss mentions are in |
| Campus LMS | Out — employee training records are in |
| Full ATS / LMS | Pipeline + hire + onboarding to-do; not a campus LMS |
| Power-BI / spreadsheet BI | Dashboard KPI pins only |
| Perfect QB Desktop clone of every list | Gaps remain after import |
| Auto-heal bad master data | Users must fix country, reorder points, customer names |

---

## Issues found vs fixed (this review)

| Issue | Impact | Fix |
| --- | --- | --- |
| Home “Customers still owe” used **calendar-year** open invoices only | Staff saw ~$37k Home vs ~$515k on Invoices → lost trust | **Verified fixed:** Home now shows **$514,883.61** (all open AR) |
| Letterhead `SOMALIA, US` | Looks unprofessional on print/PDF | **Verified:** `Furaat Store, Balcad Street, Kismaayo, Lower Juba, SO` |
| Home hard for new staff | Overwhelm | Team day path (Sell→Collect→Buy→Stock→Bank→Close) |
| Welcome “Login / Company / there” | Fake names on login-test users | Skip placeholders; fall back to plain “Welcome back” |
| Stock badge 1400+ | Noise | Cap display `1k+` (count still high until reorder data cleaned) |
| Invoice year review | Hard to see 12 months | Date preset **Last 12 months** |
| Profit KPI looked “broken” at $0 | Trust hit early in a month | Label clarified: **Profit (this calendar month)** — use Reports for YTD |

## Still open (data / product debt)

- ~1438 stock reorder warnings — master data (reorder points / zero stock), not a Home formula bug.
- Customer display names like `"22"` — clean under Customers.
- Dense apps rail — hide unused apps under **Settings → Apps & features**.
- Full `pnpm typecheck` still has unrelated legacy errors (POS/sales/qb-migrate).

---

## How to run the company for 6–12 months (easy rhythm)

1. **Morning:** Home team path → your job tile.  
2. **Sales:** Invoice or POS; end of day Payments → Banking deposit.  
3. **Store:** Stock + reorder list; don’t ignore `1k+` forever — fix reorder points.  
4. **Week:** Vendor bills + bill payments; bank reconcile.  
5. **Month:** Reports (P&L, BS, aging) → **Periods** close checklist.  
6. **Year:** Invoice filter **Last 12 months** / **All dates**; budgets vs actual; equity / assets if used.

**Hide apps you don’t use** so the rail matches the team — that is the fastest “easy use” win for Al Furaat.
