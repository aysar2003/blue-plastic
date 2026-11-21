# Phase 38 — Sales contracts & vendor retention

**Status:** Complete (FULL)

## Shipped

1. **Schema** — `SALES_CONTRACT`, `SalesContract`, `ContractMilestone`, `RETENTION_PAYABLE` (2330), bill `retentionAmount` / `retentionReleasedAt`.
2. **Milestones** — `construction.service.billMilestone`, `activateContract`, `createContract`.
3. **Vendor retention (lite)** — Amount stored on bill; `releaseVendorRetention` posts Dr `RETENTION_PAYABLE` / Cr `ACCOUNTS_PAYABLE` (bill post unchanged).
4. **UI** — `/projects/contracts` list + bill milestone forms.
5. **FULL (2026-11-21)** — billed vs remaining (contract + change orders); `changeOrderAmount` on `SalesContract`; customer `retentionPercent` held on milestone invoices (`RETENTION_RECEIVABLE`).

## Migration

`20261114180000_phase37_40_wave_a` · FULL `20261121181000_wave_a_deepen`

## Verify

```bash
pnpm exec vitest run lib/erp/contracts tests/contracts-milestones
```
