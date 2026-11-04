# Walkthrough findings (human user)

Date: 2026-10-31. Company: AL FURAAT GROUP OF COMPANY (local). Goal: ground the user manual in real UI labels and obstacles — not a security test.

## What worked

| Area | Observation |
|------|-------------|
| Sign-in / company | Session persists; **Switch company** top-left; brand shows org name + module (e.g. Sales). |
| Global chrome | **Create**, **Search ⌘K**, Apps rail, stock/balance/calendar reminders — present on Sales and Help. |
| Sales → Invoices | List loads; title **Invoices · SOM ERP**; sub-nav Open invoices / Invoices / Estimates / … matches Help Guide links. |
| Help → Guide | Existing English “order of work” cards: Setting up, A sale, A purchase, Stock, Every month, Every year + immutable rules. |
| Employees → Guide | Somali HR steps already in-app (Directory → Policies). |
| Payroll journal delete | After fix: payroll journal Delete returns run to **Draft**; re-post creates a new journal (idempotency). |
| Journal detail | Actions: Merchant, Trade, Print, PDF, Excel, Email, WhatsApp, **Delete**, **Reverse**. Footer explains delete vs reverse. |

## Obstacles / process notes (manual §14)

1. **Back** — dialog stack: Back closes open dialogs before history navigation; otherwise feels “broken”.
2. **Journal delete + payroll** — never mutate soft-deleted journal rows (idempotency key); withdraw then re-post with a new key.
3. **Dev server hang** — long-lived `next dev` + DB timeouts can freeze the UI; restart clears chrome-error pages.
4. **Payroll page** — log once showed `db.salaryStructure.findFirst` undefined if Prisma client out of sync with schema; run generate / restart after schema changes.
5. **First compile** — large routes (e.g. `/journals` list) can take tens of seconds on cold compile; wait before assuming failure.
6. **UI language** — all primary buttons stay English; Somali manual must keep English control names in bold.

## Label check (manual vs screen)

- Invoices list / New invoice paths used in ch.03 match nav.
- Journal **Delete** / **Reverse** wording matches ch.08 and journal footer.
- Payroll **Draft** / **Post payroll** / **Pay from** match ch.11 and payroll detail after unpost.
- Help hub currently: Guide, Shortcuts, The ledger — manual adds Guide (SO) + Full manual hub.

## Out of scope this pass

Security/variability audit; exhaustive POS session close; full bank reconcile with live statement file.

---

## Phase 11 + Wave A/B pass (2026-11-01)

| ID / area | Result |
| --- | --- |
| 11.1–11.17 screens | HTTP 200 on classes, rules, trash, batch invoices, custom reports, approvals, projects, POS, recurring |
| 11.2 Recurring | Scheduler: open Banking → Recurring auto-runs Create due; cron `POST /api/cron/recurring` + `CRON_SECRET`; Create now / Create due kept |
| B1 FX | Customer/vendor currency; invoice Currency + FX rate; journal foreign amounts; `/accounting/fx-revaluation`; credit limit warn toggle under Approvals features |
| B2 Timesheets | Project detail → Timesheets hours + billable rate |
| B2 Approvals | Multi-step toast fixed (level N no longer claims “posted”) |
| B3 POS | Close checklist on session close form |
| B3 Home | KPI cards P&L MTD / Open AR / To reorder |
| B3 Equity | `/accounting/equity-contribution` |
| HRIS | Deferred — documented in `docs/phases/phase-12-depth.md` |

Refusal path smoked: credit limit still hard-blocks when warn is off; empty recurring Create due stays disabled.

---

## Phases 13–17 assessment (2026-11-02)

| Check | Result |
| --- | --- |
| Plan scope SME (QBO + Odoo Community essentials) | Marked complete in `docs/progress.md` — routes/services/docs present |
| Unit smoke | `fixed-asset-depreciation` + `e2e-accounting-cycle` — 6 green |
| DB migrations | Up to date (`phase13_17_depth`, `employee_lifecycle`) |
| Form POST adapters | Equity / Sign / Discuss / Appointments / Surveys / Recruitment use FormData |
| Full `pnpm typecheck` | Still fails on **pre-existing** files (POS/sales credit-limit args, qb-migrate scripts, launch-chrome). Phase 13–17 file errors fixed in this pass |
| Browser E2E | Not a full Playwright suite — checklist documented only |
| vs full Odoo Enterprise / QBO Advanced | Hedge docs, kitchen display, first-party marketplace, bins/picks, training, sign certificate are in. Not DocuSign/Slack trademarks, not robots, not eIDAS QES. |

**Verdict:** SME ERP operating loops (sell–collect–buy–stock–books–CRM–people–collab) are in place. Not a clone of every Odoo/QBO Advanced module.

---

## AL FURAAT GROUP — human-team year review (2026-11-04)

Signed in as company staff on **AL FURAAT GROUP OF COMPANY** (Kismaayo store). Simulated how Sales / Cashier / Store / Accounts work for months–year.

| Observation | Action |
| --- | --- |
| Home said “Welcome back, Login” (test user) | Friendly first-name helper |
| Dense home — no “who does what” | **Team day path**: Sell → Collect → Buy → Stock → Bank → Close |
| KPI pin row always open / jargon (P&L MTD, Open AR) | Collapsed “Choose home numbers”; plain labels |
| Stock badge 1438 terrified the eye | Cap `1k+`; menu “Store needs attention” |
| Invoice date filter for year review | Added **Last 12 months** (keep default Last 3 months for speed) |
| Unpaid banner ~$515k vs home AR ~$37k | Filter/range difference — use **All dates** / aging report for full picture; not a posting bug in this pass |
| Address line shows `SOMALIA, US` | Data on Organisation — fix in Settings → Organisation when convenient |

Team rhythm to coach staff: day path on Home → month close in Periods → year via Reports + last-12 filter.
