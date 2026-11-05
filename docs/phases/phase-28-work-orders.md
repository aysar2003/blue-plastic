# Phase 28 — Manufacturing work orders (L5)

**Status:** Complete

## Shipped

1. **WorkOrder** (+ component lines from BOM) with DRAFT → RELEASED → DONE / CANCELLED.
2. **Complete** posts finished goods via existing `assembly-build.service` `createInTx` (consume components, receive FG, journal).
3. UI under `/inventory/work-orders` (list / new / release / complete).
4. Vitest: complete posts stock; cancel does not.

## Explicitly out

Full MES, routings, shop-floor terminals, capacity planning.
