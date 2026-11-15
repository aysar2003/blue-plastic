# Phase 40 — Localization packs

**Status:** Complete (LITE)

## Shipped

1. **Organization.localizationPackId** — Settings organisation form select.
2. **`lib/localization/packs.ts`** — `so`, `ke`, `et`, `dj` with payroll CSV headers + `eInvoiceFormat: 'json-stub'`.
3. **Payroll CSV** — `payrollStatutoryToCsv` optional headers; `payrollStatutoryToCsvForPack`.
4. **`buildEInvoiceStub`** — JSON string for e-invoice stub export.
5. **Deepen (2026-11-15)** — Posted invoice **E-invoice** download (`/api/sales/[id]/e-invoice`); payroll statutory CSV via `payrollStatutoryToCsvForPack` + `localizationPackId`.
6. **Deepen (2026-11-15b)** — Pack `taxSeed` (KE 16% / ET 15% / DJ 10% / SO exempt); `seedLocalizationTax`; richer e-invoice (lines + tax summary + buyer/supplier address); VAT box labels; ET/DJ distinct payroll headers; Setup **Seed tax for localization pack**. Still JSON/CSV only — no Peppol.

## Migration

`20261114180000_phase37_40_wave_a` (`localizationPackId` on organizations)

## Verify

```bash
pnpm exec vitest run tests/localization-packs
```
