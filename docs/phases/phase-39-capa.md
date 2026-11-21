# Phase 39 — CAPA

**Status:** Complete (FULL)

**Exit:** Owner, due, root cause, effectiveness date; link lot/vendor; quality CSV of open/overdue/closed.

## Shipped

1. **Schema** — `CAPA_NOTE`, `CapaNote`, optional `workspaceDocumentId` / `signRequestId`, `WorkspaceDocument.signRequestId`.
2. **Deepen (2026-11-15)** — Status flow OPEN → IN_PROGRESS → CLOSED with required close note; list status filters.
3. **Service** — `server/services/capa.service.ts` list, get, create, setStatus, update, exportRows.
4. **UI** — `/quality/capa` under Quality nav (`audit:read`).
5. **FULL (2026-11-21)** — `ownerId`, `dueDate`, `rootCause`, `effectivenessDate`, vendor + lot; overdue on list; CSV export of open/overdue/closed.

## Migration

`20261114180000_phase37_40_wave_a` · FULL `20261121190000_wave_b_deepen`

## Verify

```bash
pnpm exec vitest run lib/erp/capa tests/capa tests/wave-b-deepen
```