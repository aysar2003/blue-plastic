# Phase 40 — Localization packs

**Status:** Toward **FULL** (no Peppol)

## Shipped

1. **Organization.localizationPackId** — Settings organisation form select.
2. **`lib/localization/packs.ts`** — `so`, `ke`, `et`, `dj` with payroll CSV headers, `vatBoxLabels`, `taxSeed`, `eInvoice` config.
3. **Payroll CSV** — `payrollStatutoryToCsv` optional headers; `payrollStatutoryToCsvForPack`.
4. **`buildEInvoiceStub`** — JSON string with supplier/buyer addresses, line items, tax summary (by code).
5. **Deepen (2026-11-15)** — Posted invoice **E-invoice** download (`/api/sales/[id]/e-invoice`); payroll statutory CSV via pack.
6. **Deepen (2026-11-15b)** — Pack `taxSeed` (KE 16% / ET 15% / DJ 10% / SO exempt); `seedLocalizationTax`; VAT box labels on CSV/JSON export; Setup **Seed tax for localization pack**.
7. **Deepen (2026-11-21 · Wave A)** — VAT return **UI** uses pack box labels; `DEFAULT_VAT_BOX_LABELS` fallback; agency registration hints (SO/ET/DJ); seed action reports jurisdiction + “VAT boxes 1–5 mapped to pack”; pack completeness tests (headers, seeds, labels, addresses).

## Still out (FULL exit)

Peppol, government e-filing portals, live TIMS/ETRS submission, per-country PAYE XML beyond CSV headers.

## Migration

`20261114180000_phase37_40_wave_a` (`localizationPackId` on organizations)

## Verify

```bash
pnpm exec vitest run tests/localization-packs
```