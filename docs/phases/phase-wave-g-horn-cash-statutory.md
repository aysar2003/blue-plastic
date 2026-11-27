# Wave G — Horn cash & statutory deepen

**Status:** Complete (FULL) · 2026-11-22  
**Migration:** `20261122210000_wave_g_deepen`

## Goal

Deepen **mobile-money AR matching**, **withholding tax on bills**, **pack PAYE slabs**, and **e-invoice adapters** for SO/KE/ET/DJ — without Peppol, live eTIMS submit, or government portals.

## Shipped

1. **Mobile money / statement packs**
   - Packs `et` + `mm` (EVC / Zaad / M-Pesa / eDahab / Telebirr) with `partyRef` column maps.
   - `ImportedTransaction.partyRef`, `suggestedInvoiceId`, `matchScore`, `matchedCustomerPaymentId`.
   - Pure scorer `lib/erp/mobile-money-match.ts`; `suggestInvoiceMatchesForImport` + `matchInvoice` uses `MOBILE_MONEY` when narration/party looks like MM.

2. **Withholding tax (WHT)**
   - Bill fields `withholdPercent` / `withholdAmount`; UI field on bill form.
   - Post splits AP vs `WITHHOLDING_TAX_PAYABLE` (system account + CoA 2340).
   - Remittance CSV: `GET /api/reports/wht-remittance`.

3. **Pack PAYE**
   - `lib/erp/paye-packs.ts` — SO Law 37 bands, KE progressive, ET tax + 7%/11% pension, DJ defaults.
   - Setup → **Apply pack PAYE slabs** (`applyLocalizationPaye`) writes Standard structure `TAX` rule as SLABS.

4. **E-invoice adapter**
   - `lib/localization/e-invoice-adapter.ts` — stub (SO/DJ), `tims-shaped` (KE), `et-shaped` (ET); still offline JSON download only.

## Explicitly out

Peppol, live eTIMS/ETRS/Directive 1142 submit, Daraja/EVC webhooks (CSV + match only), PAYE XML to iTax.

## Verify

```bash
pnpm exec vitest run tests/wave-g-deepen.test.ts
pnpm db:deploy
```
