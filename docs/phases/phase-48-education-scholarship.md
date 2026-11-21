# Phase 48 — Scholarship summary

**Status:** Complete (FULL)

## Shipped

1. `education.scholarshipSummary(ctx, termId)`.
2. Section on `/education/fees-outstanding`.
3. `lib/erp/scholarship-summary.ts` + vitest.
4. **Deepen (2026-11-15)** — Scholarship summary CSV download on fees-outstanding.
5. **Wave E (2026-11-21)** — Award sets scholarship %; billing adds a DISCOUNT fee-waiver line on the term invoice (education models).

## Migration

None (logic only). Wave E reuses `student_enrollments.scholarshipPercent`.
