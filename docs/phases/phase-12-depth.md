# Phase 12 — Depth on existing apps (Wave B)

Started 2026-11-01. Extends Phase 11 surfaces rather than adding Discuss / Sign / Appointments / Planning / Surveys.

## Delivered in this wave

| Area | What shipped |
| --- | --- |
| Multi-currency day-to-day | Customer/vendor `currencyCode`; sales currency + FX rate; posting converts to base and stores foreign amounts; bank account currency on chart; FX revaluation journal (`/accounting/fx-revaluation`) |
| Credit limit | Settings → **Credit limit: warn and confirm** (`creditLimitWarn`); hard block remains default |
| Projects timesheets | Hours on project detail; billable rate; mark invoiced when pulled later |
| Approvals | Multi-level toast: intermediate approve no longer says “posted” |
| POS | Close-session checklist (cash moves → count → close) |
| Home | KPI cards: P&L MTD, open AR, to-reorder count |
| Equity lite | `/accounting/equity-contribution` — Dr Bank / Cr Owner's Capital |
| Recurring (Wave A) | Page-load auto Create due + `POST /api/cron/recurring` with `CRON_SECRET` |

## Explicitly deferred (Phase 12+ / separate plan)

- Full HRIS suite: recruitment, appraisals, full contract lifecycle beyond what Employees already has (status, contracts, leave, attendance, payroll)
- Shareholders register / equity rounds
- Restaurant / IoT POS
- Spreadsheet-style dashboard builder
- New apps: Discuss, Appointments, Planning, Surveys, Sign

## Testing

- Unit: FX posting path; recurring createDue empty contract
- Browser smoke: Phase 11 routes + new FX / equity / timesheet / home KPIs
