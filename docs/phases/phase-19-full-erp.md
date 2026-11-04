# Phase 19 — Remaining operational gaps

**Status:** Complete

Closes the leftover “qabyo” surfaces after Phase 18 so the product runs as a full SME ERP: manufacturing plan, messaging, home numbers, tickets, onboarding, group journals, and backup of people/collab/CRM.

## Shipped

| Area | What landed |
| --- | --- |
| MRP | `/inventory/mrp` — explode BOM, shortages, link to PO / build |
| Sign email | SMTP sends the public signing link |
| Messaging | Optional WhatsApp Cloud / webhook; wa.me fallback; SMS OTP uses the same gateway |
| Home | Pipeline, unpaid bills, follow-ups as pin-able KPIs |
| Tickets | `/customers/tickets` — subject, notes, due date, close |
| Hire | Opens an onboarding to-do |
| Intercompany | Journal checkbox prefixes `[IC]` for group consolidation |
| Backup dump | BOM components, employees, leave, planning, equity, HR, sign, surveys, CRM, discuss, appointments |
| Backup restore | Same extras replay on replace-company and import-as-new (payroll runs and contract files stay out) |

## Tests

`tests/erp-lite-complete.test.ts` — IC memo + notify digits.  
`tests/erp-readiness.test.ts` — MRP and tickets pages exist; backup dumps BOM and employees.

## Still out (eternal)

FX hedging, restaurant/IoT POS, app marketplace, WMS robotics, DocuSign/Slack clones, campus LMS, payroll-run history inside the JSON backup.
