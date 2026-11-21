# Phase 7 — Inventory

**Status:** ✅ Complete (FULL) — 2026-08-29 · landed cost 2026-11-21
**Depends on:** Phases 3, 4 and 5
**Blocks:** Phase 8 (gross margin reporting)

## Goal

Stock that is counted, valued, and whose cost lands on the profit and loss at the
moment it is sold — not before, not after.

This is the phase that lifts the restriction Phases 4 and 5 deliberately imposed.
Tracked items can now be bought and sold.

## Tasks

| # | Task | Where | Status |
| --- | --- | --- | --- |
| 7.1 | Stock ledger and weighted-average cost engine | `server/accounting/inventory.ts` | ✅ |
| 7.2 | COGS posted in the same journal as the sale | `builders/sales.ts`, `sales.service.ts` | ✅ |
| 7.3 | Receiving stock through bills and expenses | `builders/purchases.ts`, `purchase.service.ts` | ✅ |
| 7.4 | Adjustments from a stock count | `inventory.service.ts` | ✅ |
| 7.5 | Negative-stock policy and cost true-up | `inventory.ts`, `Organization.allowNegativeStock` | ✅ |
| 7.6 | Stock on hand, valuation, reorder report | `app/(app)/inventory/` | ✅ |
| 7.7 | Stock ledger equals the Inventory Asset balance | `stockAgreesWithLedger` + test | ✅ |

## The costing method

Weighted average, chosen in [ADR-0005](../decisions/0005-weighted-average-costing.md).

```
receiving:   value += quantity × cost ;  average = value / quantity
issuing:     cost = average as it stands ;  average unchanged
```

That last property is the point: **an issue does not move the average.** It is
what makes weighted average simple to keep right, where FIFO would need cost
layers re-laid every time somebody enters a back-dated document.

Unit costs are held to six decimals. A per-unit cost divides badly, and rounding
it before multiplying moves the total.

## Entry order, not date order — and why

Every movement carries the item's position *after* it. That makes the ledger
checkable: a trigger verifies each row against its predecessor, so a bug in the
costing engine cannot quietly accumulate.

It also means the chain has one order, and it is **the order movements were
recorded**, not the order they are dated.

So a purchase back-dated behind a sale does **not** restate that sale's cost of
goods. The cost was what the books knew at the time; the difference flows into
later averages instead.

The alternative — recomputing the chain and reversing already-posted COGS
journals — restates a profit figure that has been reported, in order to correct an
entry somebody made late. Between a small timing difference and a moving history,
accounting takes the timing difference every time.

## The invariant that makes it trustworthy

> The stock ledger's total value equals the Inventory Asset balance in the general
> ledger.

It holds by construction: every movement posts exactly its own `value` to that
account, in the same database transaction that writes the movement. The check is
on the Inventory page, and a test asserts it through a full buy-and-sell cycle —
and asserts that it *notices* when they disagree, because an invariant nobody
verifies is an invariant nobody has.

One subtlety: when stock returns to zero, any rounding residue is squeezed out of
the last movement. Otherwise a few cents would sit in Inventory Asset for ever,
attached to no stock at all.

## Cost of goods sold rides with the sale

```
Invoice:      Dr AR · Cr Income · Cr Tax · Dr COGS · Cr Inventory
Credit memo:  Dr Income · Dr Tax · Cr AR · Dr Inventory · Cr COGS
Bill:         Dr Inventory (not expense!) · Dr Tax · Cr AP
```

Both halves are in **one journal**. A sale and its cost are one event; splitting
them into two entries lets a report be run between them and show a gross margin
that was never real.

Buying stock puts its cost in the **inventory asset, not expense**. The business
has swapped cash for goods, it has not spent anything yet — the expense arrives
when the goods are sold. Charging it on arrival would expense the purchase twice.

## Negative stock

Off by default. Selling what you do not have means costing it at a price nobody
has paid, and the error surfaces later as a margin that moves on its own.

A business that genuinely sells ahead of delivery can turn it on
(`allowNegativeStock`). Issues are then costed at the last known price — the most
recent receipt, or the item's purchase cost if there has never been one — and the
next receipt trues the average up automatically, because that is simply what the
weighted-average arithmetic does.

## Adjustments

The form asks for **what the count found**, not for the difference, because that
is what the person holding the clipboard knows. The document records what the
books said, what was counted and the difference, so it reads correctly years later
without recomputing history.

The value difference goes to **Inventory Shrinkage**, an expense. Burying it in
cost of goods sold would flatter the margin on everything that actually sold.

## The guards

Six more, bringing the total to **51**:

| Guard | Prevents |
| --- | --- |
| `trg_inventory_movement_immutable` | editing or deleting a stock movement — the ledger is append-only, exactly like the general ledger, and for the same reason. One transition is permitted: attaching a movement to the journal it was posted with, since the cost must be known before the journal can be built |
| `trg_movement_continuity` | a running total that does not follow from the movement before it, or a gap in the sequence |
| `trg_movement_item_tracked` | moving stock for a service, which would put value in Inventory Asset with no stock behind it |
| `inventory_transactions_non_zero` | a movement of nothing |
| `adjustment_lines_change` | an adjustment line whose arithmetic does not hold |
| `adjustment_lines_document_org_fkey` | crossing organisations (R9) |

## Verification

`pnpm verify` — lint clean, typecheck clean, **226 tests**. `pnpm build` clean.
`pnpm db:verify` — all 51 integrity objects present.

| Area | Covered |
| --- | --- |
| Costing (8) | averaging two receipts at different prices; an issue costing at average and leaving it unchanged; a cost that does not divide evenly; rounding residue squeezed out at zero stock; selling more than exists refused; negative stock allowed and trued up by the next receipt; a receipt with no cost refused; moving stock for a service refused |
| Append-only (4) | update refused, delete refused, a false running total refused, a sequence gap refused |
| The invariant (2) | equality held through buy-and-sell, and the check proved to notice a movement posted without its journal |
| Journal linking (2) | the journal may be set once and only once, and no other change may ride along with it |

### Three bugs the end-to-end run caught

Unit tests would not have found any of them; only posting real documents did.

1. **Tracked stock was debited twice** — once to Inventory Asset by the new stock
   lines, and again to Uncategorised Expense because the expense builder's
   fallback did not know to skip it. Lines now carry an `isStock` flag.
2. **The immutability trigger blocked the service linking a movement to its
   journal** — the same lesson as Phase 2's reversal. Fixed by permitting that one
   transition rather than by loosening the rule.
3. **A sales return had no cost to re-enter at.** Stock coming back now re-enters
   at what the books already carry it at; anything else would move the average for
   a reason unconnected to what the business paid.

## What Phase 7 deliberately does not do

- No FIFO or specific identification. `inventory_transactions` retains quantity,
  unit cost, date and document, so layers could be rebuilt if a real requirement
  ever appears — see ADR-0005.
- No back-dated recosting, for the reason set out above.

## Wave A deepen — landed cost (2026-11-21)

Freight/duty on a posted bill can be allocated onto inventory weighted-average
cost without rewriting history.

1. `LandedCostBatch` / `LandedCostLine` — bill, memo, journal, item amounts.
2. `allocateLandedCost` — zero-qty `ADJUSTMENT` movement with `valueOverride`,
   journal Dr Inventory Asset / Cr the bill's freight expense.
3. UI: bill **Allocate to receipts** (`/purchases/bills/[id]/landed-cost`) and
   `/purchases/landed-costs`. Candidates are stock items on the bill, its PO, or
   recent receives from the same vendor.

Migration: `20261121180000_wave_a_landed_cost_ship_to` (apply with `pnpm db:deploy`).

Verify: `pnpm exec vitest run tests/landed-cost`
