# Phase 47 — NGO fund restrict

**Status:** Complete (FULL)

## Shipped

1. `tracking_categories.restrictSpending`.
2. Purchase `BILL`/`EXPENSE` post requires document class when any active restricted class exists.
3. Toggle on `/settings/classes`.
4. **Deepen (2026-11-15)** — Grant encumbered open PO + hub over-budget banner.
5. **Wave E (2026-11-21)** — Grant BvA by class (CSV); pledge receive writes a receipt note on the payment and pledge; donor CSV when pledges exist.

## Migration

`20261114200000_phase41_50_wave_b`

Wave E: `20261121201000_wave_e_deepen` (`donor_pledges.receiptNote`)
