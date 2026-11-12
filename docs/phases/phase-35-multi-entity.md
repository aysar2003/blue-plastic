# Phase 35 — Multi-entity & intercompany harden

**Status:** Complete

**Exit:** A company group can close books together — ownership %, IC matching, group close checklist, and consolidation with NCI.

## Shipped

1. **Ownership %** — `organizations.ownershipPercent` (0–100, default 100) on each child→parent link. Editable on `/reports/group-close`. Attach-sub accepts optional %.
2. **IC matching** — `IntercompanyMatch` pairs two posted `[IC]` journals across orgs in the same group. Suggest/confirm/unmatch at `/reports/intercompany`. Unmatched count feeds the checklist.
3. **Group close checklist** — `/reports/group-close`: per-entity period status for an as-of date, unmatched IC, multi-currency warning, ownership coverage. Linked from Reports, period month, and consolidation.
4. **Consol + NCI** — `/reports/consolidation` rolls subsidiary totals at ownership % and shows non-controlling interest when ownership &lt; 100. `[IC]%` memos still skipped for elimination.

## Migration

`20261111140000_phase35_multi_entity`

## Explicitly out

Phases 36–40, Wave B leftovers, full SAP consol, statutory multi-GAAP, automated elimination journals.

## Verify

```bash
pnpm exec vitest run tests/consolidation-ownership tests/company-group
pnpm exec tsc --noEmit
```
