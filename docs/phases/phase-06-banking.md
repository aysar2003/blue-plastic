# Phase 6 — Banking & Cash

**Status:** ✅ Complete (FULL) — 2026-08-29 · statement format packs Wave C 2026-11-21
**Depends on:** Phases 2, 4 and 5
**Blocks:** Phase 8 (cash flow), Phase 9 (period close)

## Goal

Proving that what the books say about money agrees with what the bank says.

## Tasks

| # | Task | Where | Status |
| --- | --- | --- | --- |
| 6.1 | Bank and credit-card registers with balances | `app/(app)/banking/`, `banking.service.ts` | ✅ |
| 6.2 | Transfers between accounts | `builders/banking.ts` | ✅ |
| 6.3 | Deposits, clearing Undeposited Funds | `banking.service.ts` | ✅ |
| 6.4 | Statement import into a staging table | `statement-import.service.ts` | ✅ |
| 6.5 | Matching engine | same | ✅ |
| 6.6 | Reconciliation, difference must be zero | `reconciliation.service.ts` | ✅ |
| 6.7 | Reconciliation history and undo, with audit | same | ✅ |

## The design problem this phase had to solve

Reconciliation needs to mark journal lines as cleared. **Journal lines are
immutable (R4)** — the trigger would refuse, rightly.

The answer is not to weaken the rule. Clearing is recorded in
`reconciliation_entries`, a separate table keyed by journal line, so the fact
lives *beside* the line rather than on it. The ledger stays append-only through
reconciliation, and as a bonus the full history of which reconciliation cleared
what is kept rather than being a boolean that gets flipped.

A test asserts the point directly: after clearing a line, its `debit`, `credit`
and `journalDate` are byte-for-byte what they were.

## What reconciliation actually is

```
beginning balance  +  what you have ticked  =  the statement's closing balance
```

When that holds, the books and the bank agree about every item up to that date.
When it does not, **the difference is the size of what is missing** — and the
screen says so in the largest number on the page.

Finish is disabled until the difference is exactly zero. A reconciliation that can
be completed while it is out is not a reconciliation; it is a note saying somebody
looked.

The beginning balance is **stored**, not recomputed, so a finished reconciliation
reads the same for ever even as earlier months are re-examined.

## Undo is deletion, not editing

A completed reconciliation is locked by trigger. Undoing one **deletes** it and
releases every line it cleared, and says so in the audit log. It is not an edit,
because a reconciliation that can be edited is not evidence of anything.

Only the most recent reconciliation on an account may be undone — undoing an
earlier one would leave the later ones resting on a beginning balance that no
longer means anything.

## Undeposited Funds, and why deposits matter

A customer payment received in cash or by cheque goes to **Undeposited Funds**,
not straight to the bank. It sits there until someone physically banks it.

A deposit clears that holding account and puts the money where the statement will
show it. Without this step the register shows five payments where the bank shows
one paying-in slip, and reconciliation becomes an exercise in matching things that
were never going to match.

A deposit line is either a payment being banked or money from somewhere else —
interest, a refund, an owner's injection — and a CHECK enforces exactly one.

## Importing a statement

An imported row is **a claim by the bank, not an entry in the books**. It is held
in `imported_transactions` until someone decides what it is. Nothing in the import
path writes to the ledger, which is why importing a statement can never put the
accounts wrong.

The reader accepts the two conventions that cover nearly every export — a single
signed `amount`, or separate money-in and money-out columns — and both `YYYY-MM-DD`
and day-first `DD/MM/YYYY`. Duplicates are caught by the bank's own identifier
where the file has one, and by an exact date/amount/description match where it
does not.

**Suggestions require an exact amount match** within a few days. A near-match is
not a match — it is two different transactions, and offering it as a suggestion is
how a reconciliation ends up burying a real discrepancy. `match()` re-checks the
amount server-side and refuses if they differ.

## Transfers

A transfer posts between two accounts and touches no income or expense. Recording
one as a sale on one side and a purchase on the other is a common way for a set of
books to overstate both, so a test asserts the journal has exactly two lines, and a
CHECK refuses a transfer to the same account — which would net to nothing, balance
perfectly, and be invisible on every report.

Voiding a transfer or deposit that has already been reconciled is refused: it
would put a finished reconciliation out by exactly that amount.

## The guards

Ten more, bringing the total to **45**:

`bank_transfers_distinct_accounts`, `bank_transfers_positive`,
`deposit_lines_one_source`, `deposit_lines_positive`, `trg_deposit_total`,
`trg_reconciliation_immutable`, `trg_reconciliation_entry_locked`,
`trg_entry_account_matches` (a reconciliation only clears lines on its own
account), `reconciliations_one_in_progress`, and the deposit tenancy key.

## Verification

`pnpm verify` — lint clean, typecheck clean, **212 tests**. `pnpm build` clean.
`pnpm db:verify` — all 45 integrity objects present.

| Area | Covered |
| --- | --- |
| Builders (6) | transfer proved to have exactly two lines and no P&L account; deposit proved to merge sources and balance |
| Guards (10) | transfer to itself, zero transfer, deposit line with neither source, deposit total disagreeing with lines, clearing a line from another account, two reconciliations in progress, clearing a line twice, changing a completed reconciliation, adding to a completed one, and — most importantly — that clearing a line leaves the line itself untouched |

## Wave C — statement import format packs (2026-11-21)

CSV import on `/banking/import` accepts **column mapping presets** (`generic`, `so`, `ke`) for common Somalia and Kenya bank layouts (value date / particulars / Dr-Cr, paid in / withdrawn). Still not a live bank feed.

Migration: `20261121191000_wave_c_deepen` (no extra tables — mapping is code).

## What Phase 6 deliberately does not do

- No OFX or QIF parsing. CSV covers what banks actually hand a small business,
  and a second format is a second thing to get subtly wrong.
- No live bank feeds. That is an integration, not an accounting feature.
