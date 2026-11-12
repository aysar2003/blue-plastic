# Lite vertical close — Pass 1

**Status:** Complete · 2026-11-11  
**Migration:** `20261111120000_phase_lite_close_pass1`

One weekly-ops gap per industry pack (IN only). Wave B leftovers and phases 35–60 stay deferred.

## Delivered

| Pack | Gap |
|------|-----|
| Restaurant | Tip payout from night audit (Dr Tips Payable → bank) |
| Hotel | Nightly room rate post onto open folios (`serviceDate`) |
| Pharmacy | Expired lot disposal → damage adjustment + lot stamp |
| School / university | Bill all unbilled enrollments for a term |
| Hospital | Claim export stamp (`claimsExportedAt`) |
| NGO | Fund BS by class |
| Professional services | WIP write-up / write-down % |
| Construction | Site store link on project |
| Manufacturing | Weekday capacity (Mon–Sun) on work centers |
| Distribution | Dock name + appointment time on ASN |
| Retail | Named price lists + % promotions |

## Out (unchanged)

EMR, LMS/SIS, OTA, PLC/MES, AIA G702, robotics, multi-currency fund engine.

## Verify

```bash
pnpm exec prisma migrate deploy
pnpm exec vitest run tests/packs tests/pharmacy tests/education tests/hospital-billing tests/hospitality tests/verticals tests/lite-close-pass1
pnpm exec tsc --noEmit
```
