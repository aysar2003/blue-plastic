# Phase 45 — Distribution bins + wave labels

**Status:** Complete (FULL)

**Exit:** Dock calendar on ASN; wave pick→issue→packing CSV; ASN vs PO discrepancy.

## Shipped

1. `ItemBinDefault` model; putaway suggests default bin.
2. `wms.waveLabelExport` + `GET /api/waves/[waveId]/labels`.
3. Bins UI “Label JSON” per wave; `upsertItemBinDefault` service.
4. **Deepen (2026-11-15)** — Wave labels CSV download; missing default-bin warning.
5. **FULL (2026-11-21)** — Dock calendar from ASN `dockName`/`dockAt`; wave packing-list CSV (`?format=packing`); ASN vs PO discrepancy table + CSV.
6. **Wave H (2026-11-25)** — Shipping-label CSV (`?format=csv`) confirmed as the clerk path; JSON payload kept for machines (no longer called a stub).

## Migration

`20261114200000_phase41_50_wave_b` · FULL logic (no extra ASN schema) `20261121190000_wave_b_deepen`

## Verify

```bash
pnpm exec vitest run tests/wave-b-deepen tests/wave-b-41-50
```