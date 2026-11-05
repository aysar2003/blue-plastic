# Phase 29 — WMS picks move stock (L4)

**Status:** Complete

## Shipped

1. Completing a pick **issues** on-hand via `recordMovement` (refuses short stock when negative stock is off).
2. Optional **sales order** link (`sourceType` / `sourceId`); lot/serial fields when the item tracks (Phase 24).
3. Bin remains a location hint — no second quantity ledger by bin.
4. Vitest: pick reduces on-hand; cannot cancel after PICKED.

## Explicitly out

Robotics, AS/RS, PLC, bin-level perpetual qty ledger.
