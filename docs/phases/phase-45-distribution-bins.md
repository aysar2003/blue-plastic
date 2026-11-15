# Phase 45 — Distribution bins + wave labels

**Status:** Complete (LITE)

## Shipped

1. `ItemBinDefault` model; putaway suggests default bin.
2. `wms.waveLabelExport` + `GET /api/waves/[waveId]/labels`.
3. Bins UI “Label JSON” per wave; `upsertItemBinDefault` service.
4. **Deepen (2026-11-15)** — Wave labels CSV download; missing default-bin warning.

## Migration

`20261114200000_phase41_50_wave_b`