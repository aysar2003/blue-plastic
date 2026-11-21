# Depth pass — CRM, portal, MRP, public API

**Status:** Complete · 2026-11-21

## Why

These five areas were SME-complete but shallow: CRM stayed “as shipped,” portal quotes were view-only, MRP qty was manual-only, FSM stayed LITE, and the machine API had five starter capabilities.

## Shipped

| Area | What deepened |
| --- | --- |
| **Portal** | Customer accept / decline on open estimates & quotations (`respondToQuote` → `ACCEPTED` / `DECLINED`) |
| **Sales** | Staff Accept / Decline on open proposals (same write path; status enum was unused) |
| **CRM** | Moving an opportunity to **Won** creates a **draft estimate** (when `invoice:create`) and notes the link |
| **MRP** | Open sales demand (orders + accepted quotes) drives plan qty; “Use open demand” on `/inventory/mrp` |
| **Public API** | `customers.list`, `serviceJobs.list`, `crm.board`, `mrp.materialsPlan` (+ OpenAPI / MCP mirror) |

## Explicitly out (still)

Portal online pay, marketing automation, full MES, dispatch GPS board, webhooks.

## Verify

```bash
pnpm exec vitest run tests/phase-22-machine-api tests/depth-crm-portal-mrp-api
```
