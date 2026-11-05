# Phase 27 — Statutory payroll export + VAT return (L7 / L1)

**Status:** Complete

## Shipped

1. **Payroll statutory CSV/JSON** — posted payslips in a date range (`/employees/payroll/statutory` + `/api/employees/payroll/statutory`).
2. **One-jurisdiction VAT return** — Boxes 1–5 from posted tax lines (`/reports/vat-return` + `/api/reports/vat-return`), jurisdiction = organisation country (default `SO`).
3. Pure shape helpers + Vitest: `lib/statutory-exports.ts`.

## Explicitly out

Government e-filing portals, multi-jurisdiction VAT schemes, PAYE XML schemas per country beyond the generic CSV/JSON pack.
