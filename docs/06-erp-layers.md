# 06 — ERP layers (world-ERP build order)

Som ERP is built the way complete mid-market ERPs are built: **platform first,
ledger next, then operating documents, then depth on each layer**. Phases 1–21
shipped the SME operating loops. From Phase 22 onward, progress means deepening
**one layer at a time** without duplicating business rules outside
`server/services/*`.

## Layer map

| Id | Name | Exit when | Som status after Phase 21 |
| --- | --- | --- | --- |
| L0 | Platform — identity, RBAC, audit, tenancy | Every mutation is org-scoped, permission-checked, audited | **complete** (app); machine surface arrives in Phase 22 |
| L1 | Financial core — GL, periods, close | Balanced journals only; TB nets; period lock | **complete** (+ Phase 27 VAT return pack) |
| L2 | Master data — customers, vendors, items, tax | Account mappings drive posting | **complete** |
| L3 | Order-to-cash / Procure-to-pay | Full document chains post correctly | **complete** (Phase 23 hard 3-way match) |
| L4 | Inventory / WMS | Stock ledger agrees with Inventory Asset | **complete** trading + lot/serial (Phase 24) + picks that post stock (Phase 29) |
| L5 | Manufacturing | Work orders / routings when needed | **complete** SME (BOM + MRP + assembly + work orders, Phase 28); not MES |
| L6 | CRM / Projects | Pipeline + job costing usable | **complete** job P&L (Phase 25); CRM pipeline remains as shipped |
| L7 | HR / Payroll | Operational payroll posts to GL | **complete** ops + statutory CSV/JSON (Phase 27) |
| L8 | Reporting / close | Statements + close checklist | **complete** statements + packs (Phase 26) + SME dashboards (Phase 30); not a BI warehouse |
| L9 | Integration / AI | Machine API + capability registry over services | **Phase 22** |

## Rule of progress

1. One phase deepens **one layer** (or L0+L9 together when the platform must speak).
2. Domain logic lives once in `server/services/*` (+ `server/accounting/*` for the GL).
3. UI (Server Actions), `/api/v1`, and MCP tools are thin adapters — same Zod, same permissions.
4. Ledger integrity rules in [02-accounting-design.md](./02-accounting-design.md) never bend for an API.

## Non-goals (eternal)

Untrusted third-party plugins, DocuSign / eIDAS QES trademarks, robot/PLC, IoT kitchen printers, FX dealing desk / ISDA. See `ERP_NON_GOALS` in `lib/erp/readiness.ts`.

## How to fix a defect later

Change the service (or posting builder). Re-run tests. UI, OpenAPI, and MCP inherit the fix because they call the same function. Do not patch behaviour only in a route or only in a form. Detail: [ADR-0014](./decisions/0014-machine-api-single-service.md).

## Wave ladder after Phase 22

| Phase | Layer | Slice |
| --- | --- | --- |
| 22 | L0 / L9 | API keys, OpenAPI, capabilities, MCP mirror |
| 23 | L3 | Hard 3-way match + variance hold |
| 24 | L4 | Lot / serial on receive / issue |
| 25 | L6 | Project profitability |
| 26 | L8 | Scheduled report packs |
| 27 | L1 / L7 | One-jurisdiction VAT **or** payroll statutory export |
