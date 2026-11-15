# Phase 37 — Service jobs

**Status:** Complete (LITE)

**Exit:** Van / field jobs schedule → complete → posted invoice + van stock issue.

## Shipped

1. **Schema** — `SERVICE_JOB`, `ServiceJob` / `ServiceJobLine`, `Store.isVan`.
2. **Service** — `server/services/service-job.service.ts` create, schedule, complete, cancel, list, get.
3. **Complete** — Posted `INVOICE` via `salesService.create`; PART lines pass van `storeId` so sale posting issues stock.
4. **UI** — `/service/jobs` (+ new, detail actions).
5. **Deepen (2026-11-15)** — Complete refuses when van stock short (`allowNegativeStock` false); PART lines issue from van on invoice post (ISSUE/COGS via sales post).
5. **Nav** — Sales tab “Service jobs” (`invoice:read`).

## Migration

`20261114180000_phase37_40_wave_a`

## Verify

```bash
pnpm exec vitest run lib/erp/service-job tests/service-job
```