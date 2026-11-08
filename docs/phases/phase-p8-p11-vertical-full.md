# P8–P11 — Vertical lite → full

**Status:** Complete · 2026-11-08  
**Migration:** `20261108130000_phase_p8_p11_vertical_full`

## P8 — Distribution ASN full

- `receiveAsn` matches ASN lines to open PO remaining qty (`matchAsnToPoLines`).
- Posts stock via `purchaseService.receiveOrder` (bill + inventory).
- UI: Receive into stock on `/inventory/asn`.
- Pack copy: no “ASN lite”.

## P9 — Professional services WIP full

- `billWipFromTime` → invoice lines from unbilled time + `markInvoiced`.
- `billRetainer` wired from `/projects/wip`.
- Pack copy: “Retainer / WIP billing from time”.

## P10 — Construction retention GL

- System account `RETENTION_RECEIVABLE` + chart seed `1350`.
- Invoice journal: Dr AR (net) + Dr retention receivable / Cr income (held).
- `releaseRetention`: Dr AR / Cr retention receivable; `retentionReleasedAt`.
- UI release table on `/projects/progress`.

## P11 — Manufacturing routing capacity

- `WorkCenter` model (weekly capacity minutes, optional store).
- Routing steps link to work centers.
- `capacityReport`: open WO demand vs weekly capacity.
- UI on `/inventory/routing`.

## Verify

```bash
pnpm exec prisma migrate deploy
pnpm exec vitest run tests/verticals tests/sales-builders.test.ts tests/packs
pnpm exec tsc --noEmit
```

## Still out of scope

PLC/MES, AIA G702 field apps, robotics, clinical EMR.
