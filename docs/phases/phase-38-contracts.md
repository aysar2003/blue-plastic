# Phase 38 — Sales contracts & vendor retention

**Status:** Complete (LITE)

## Shipped

1. **Schema** — `SALES_CONTRACT`, `SalesContract`, `ContractMilestone`, `RETENTION_PAYABLE` (2330), bill `retentionAmount` / `retentionReleasedAt`.
2. **Milestones** — `construction.service.billMilestone`, `activateContract`, `createContract`.
3. **Vendor retention (lite)** — Amount stored on bill; `releaseVendorRetention` posts Dr `RETENTION_PAYABLE` / Cr `ACCOUNTS_PAYABLE` (bill post unchanged).
4. **UI** — `/projects/contracts` list + bill milestone forms.

## Migration

`20261114180000_phase37_40_wave_a`

## Verify

```bash
pnpm exec vitest run lib/erp/contracts tests/contracts-milestones
```