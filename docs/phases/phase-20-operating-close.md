# Phase 20 — Operating close of remaining qabyo

**Status:** Complete

Closes the last SME operating gaps after Phase 19: backup **restore** of people/collab/CRM, customer portal quotes, and appointment-type CRUD.

## Shipped

| Area | What landed |
| --- | --- |
| Backup restore | After books restore, extras return: BOM components, employees, leave, planning, equity, ATS, appraisals, sign, surveys, CRM, discuss threads, appointment types |
| Portal | Customers open estimates and quotations at `/portal/quotes` (list, paper, PDF) |
| Appointments | Staff create named types with duration; booking still refuses overlaps |

## Tests

`tests/erp-readiness.test.ts` — quotes pages, restore extras, appointment type form.

## Still not this product

FX hedging, restaurant IoT POS, app marketplace, WMS robotics, DocuSign/Slack clones, lots/serials costing, Playwright suite.

Offline POS (IndexedDB queue + PWA install) shipped after this phase — see `lib/pos-offline/` and till menu Sync / Install App.
