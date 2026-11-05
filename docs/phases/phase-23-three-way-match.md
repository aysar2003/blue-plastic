# Phase 23 — Hard 3-way match (L3)

**Status:** Complete

## Shipped

- Bill post against a purchase order compares qty/price to the PO and to goods received.
- Mismatches park the bill on `MATCH_HOLD` with `matchVarianceNote` (no journal).
- `bill:approve` can approve the variance and post (`approveMatchVariance`).
- Standalone bills (no `convertedFromId`) are unchanged.
- Pure matcher: `lib/purchase-three-way-match.ts`.
- UI banner + approve button on the bill detail page.
- Migration `20261105200000_phase23_three_way_match`.

## Explicitly out

Soft tolerances beyond one cent / qty rounding, automated email on hold, multi-currency match quirks beyond document currency.
