# Phase 27 — Statutory payroll export + VAT return (L7 / L1)

**Status:** Toward **FULL** (with Phase 40 pack)

## Shipped

1. **Payroll statutory CSV/JSON** — posted payslips in a date range (`/employees/payroll/statutory` + `/api/employees/payroll/statutory`); headers from `localizationPackId`.
2. **One-jurisdiction VAT return** — Boxes 1–5 from posted tax lines (`/reports/vat-return` + `/api/reports/vat-return`); jurisdiction label + **pack box labels** on screen, CSV, and JSON.
3. Pure shape helpers + Vitest: `lib/statutory-exports.ts`, `tests/localization-packs`.

## Deepen (2026-11-21 · Wave A)

- VAT return page reads `boxLabels` from statutory export (SO/KE/ET/DJ French/English labels).
- JSON export includes `boxLabels` alongside numeric boxes.

## Explicitly out

Government e-filing portals, multi-jurisdiction VAT schemes, PAYE XML schemas per country beyond the generic CSV/JSON pack, Peppol.