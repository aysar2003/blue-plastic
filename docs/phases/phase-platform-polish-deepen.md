# Platform polish + vertical deepen + Grant-to-all

**Status:** Complete · 2026-11-10

## Apps catalog

- `/databases/apps` shows companies missing each module and a **Grant to all** action (system owner).
- Confirm dialog; opt-in apps called out honestly.
- Service: `grantModuleToAllCompanies` + `grantModuleOnFlags` (idempotent).

## Vertical deepen (IN only)

| Area | Delivered |
|------|-----------|
| Pharmacy | Controlled lot **movements** on `/inventory/expiry` |
| School / university | Fees outstanding by term (`/education/fees-outstanding` + hub) |
| Hospital admin | Patient AR + services by department on hub |
| NGO | Hub snapshot (open pledges + grant variance) |
| Professional services | WIP / utilization empty states |
| Construction | Retention empty state + job cost vs contract table |
| Manufacturing | Capacity empty state on routing |
| Distribution | ASN receive/create error banner + match failure message |
| Trading packs | Report packs checklist links |
| Restaurant / hotel | Night audit / occupancy / POS cross-links on hospitality hub |

## Still out of scope

EMR, LMS/SIS, OTA, IoT printers, MES/PLC, robotics, AIA G702.

## Verify

```bash
pnpm exec vitest run tests/grant-module-all.test.ts tests/packs tests/pharmacy tests/education tests/hospital-billing tests/hospitality tests/verticals
pnpm exec tsc --noEmit
```

## Manual smoke

1. Open `/databases/apps` → Projects or Approvals &lt; 100% → **Grant to all** → bar 100%.
2. Open expiry / education fees-outstanding / hospital hub / progress / ASN / routing once each.
