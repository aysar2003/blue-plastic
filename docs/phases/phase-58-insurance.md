# Phase 58 — Insurance policies

**Status:** Complete (FULL) — Wave C 2026-11-21

## Shipped

1. `InsurancePolicy` CRUD + optional `recurringTemplateId`.
2. UI `/insurance/policies`.
3. **Deepen (2026-11-15)** — **Bill recurring** from premium; auto-`LAPSED` when past `endDate` on list/get.
4. **FULL (2026-11-21)** — `coverStart` / `coverEnd` on the policy (vehicle/cargo/site window); **claim register** `InsuranceClaim` (amount, status, payer) + simple UI on the policies page. No underwriting.

## Migration

`20261114220000_phase51_60_wave_cd`  
Wave C: `20261121191000_wave_c_deepen`
