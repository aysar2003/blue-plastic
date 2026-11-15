# Phase 39 — CAPA

**Status:** Complete (LITE)

## Shipped

1. **Schema** — `CAPA_NOTE`, `CapaNote`, optional `workspaceDocumentId` / `signRequestId`, `WorkspaceDocument.signRequestId`.
2. **Deepen (2026-11-15)** — Status flow OPEN → IN_PROGRESS → CLOSED with required close note; list status filters.
2. **Service** — `server/services/capa.service.ts` list, get, create, setStatus.
3. **UI** — `/quality/capa` under Quality nav (`audit:read`).

## Migration

`20261114180000_phase37_40_wave_a`

## Verify

```bash
pnpm exec vitest run lib/erp/capa tests/capa
```