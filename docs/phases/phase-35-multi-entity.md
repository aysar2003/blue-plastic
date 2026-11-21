# Phase 35 — Multi-entity & intercompany harden

**Status:** Complete (FULL)

**Exit:** A company group can close books together — ownership %, IC matching, group close checklist, consolidation with NCI, and confirmed matches post elimination memo journals.

## Shipped

1. **Ownership %** — `organizations.ownershipPercent` (0–100, default 100) on each child→parent link. Editable on `/reports/group-close`. Attach-sub accepts optional %.
2. **IC matching** — `IntercompanyMatch` pairs two posted `[IC]` journals across orgs in the same group. Suggest/confirm/unmatch at `/reports/intercompany`. Unmatched count feeds the checklist.
3. **Elimination memo pair (Wave D)** — Confirming a match posts a balanced Dr/Cr journal in each company on `IC_ELIMINATION_DEBIT` / `IC_ELIMINATION_CREDIT` (`[IC] ELIM …`). Unmatch reverses those journals. Elimination memos are not re-suggested as unmatched IC.
4. **Group close checklist** — `/reports/group-close`: per-entity period status for an as-of date, unmatched IC, multi-currency warning, ownership coverage. Linked from Reports, period month, and consolidation.
5. **Consol + NCI** — `/reports/consolidation` rolls subsidiary totals at ownership % and shows non-controlling interest when ownership &lt; 100. `[IC]%` memos still skipped for elimination.

## Migration

`20261111140000_phase35_multi_entity` · Wave D `20261121200000_wave_d_deepen`

## Explicitly out

Phases 36–40, Wave B leftovers, full SAP consol, statutory multi-GAAP.

## Verify

```bash
pnpm exec vitest run tests/wave-d-deepen tests/consolidation-ownership tests/company-group
pnpm exec tsc --noEmit
```
