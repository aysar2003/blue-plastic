# Phase 49 — Hospital claims batch

**Status:** Complete (FULL)

## Shipped

1. `patient_visits.exportBatchId` + index.
2. `exportClaims` assigns batch on stamp; payer + batch filters on claims UI.
3. **Deepen (2026-11-15)** — Claim CSV includes batch id / exported-at; hub unexported queue.
4. **Wave E (2026-11-21)** — Claim status submitted / paid / denied; remittance note applies a customer payment to the visit AR invoice. No EMR.

## Migration

`20261114200000_phase41_50_wave_b`

Wave E: `20261121201000_wave_e_deepen` (`PatientClaimStatus`, `claimStatus`, `remittanceNote`, `remittancePaymentId`)
