# Phase 24 — Lot / serial on receive and issue (L4)

**Status:** Complete

## Shipped

- Item flags `trackLots` / `trackSerials` (product dialog).
- `InventoryTransaction.lotNumber` / `serialNumber`; purchase and sales document lines carry the same.
- `recordMovement` enforces lot/serial rules and on-hand by lot or serial before issue.
- Receive form collects lot/serial; sales lines show fields when the item tracks.
- Inventory → **Stock by lot** lists on-hand by lot or serial.
- Pure helpers + Vitest: `lib/inventory-lot-serial.ts`.
- Migration `20261105210000_phase24_lot_serial`.

## Explicitly out

FEFO/FIFO lot picking UI, barcode-driven serial scan at POS, lot-level weighted average costing (costing stays item-level weighted average).
