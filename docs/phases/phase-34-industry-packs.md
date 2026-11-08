# Phase 34 — Industry pack framework

**Status:** Framework complete; vertical deepen + P6 gate + P7 wizard shipped (see [phase-p6-p7-onboarding.md](./phase-p6-p7-onboarding.md)).

## Shipped

1. **Pack registry** (`lib/packs`) — 16 institution packs with modules, document kinds, behavioral defaults, checklist, IN/OUT notes. In-memory O(1) lookup (safe under high page views).
2. **`resolveFeatureFlagsFromPack`** — pure flag builder; grant replace (system owner / company OWNER–ADMIN onboarding) vs clamp.
3. **`Organization.installedPackId`** + migration `20261107220000_phase34_industry_packs`.
4. **`pack.service.installPack` / `installPackForOrg`** — writes flags, optional CoA seed, audit.
5. **Databases → Limits** — Install pack control for system owner.
6. **Help → Coverage** (`/help/coverage`) — honest institution + accounting coverage.
7. **Tests** — `tests/packs/registry.test.ts`.
8. **Verticals P1–P5** — hospitality, pharmacy, education, hospital billing, NGO/services/construction/mfg/distribution — all `verticalStatus: ready`.
9. **P6/P7** — coverage gate + `/onboarding` wizard + Settings → Setup.

## Pack vertical status (honest)

| Ready (module + domain OK for claim) | Planned vertical |
| --- | --- |
| all 16 packs | _(none — P6 gate clear)_ |

## Explicitly out

- Clinical EMR, LMS, OTA channel manager, IoT printers, PLC/MES, AIA G702 field apps

## Follow-on full loops

P8–P11 ([phase-p8-p11-vertical-full.md](./phase-p8-p11-vertical-full.md)): ASN→PO/stock, WIP bill-from-time, retention GL + release, routing work-center capacity.

## Verify

```bash
pnpm exec vitest run tests/packs/registry.test.ts tests/erp-readiness.test.ts
pnpm verify   # before hand-off when practical
```
