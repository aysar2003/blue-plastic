# Phase hospitality — Restaurant + Hotel vertical

**Status:** Complete (SME hospitality ERP lite)

## Shipped

### Restaurant
- Dining tables (`/pos/tables`) with OPEN / SEATED / BILL
- POS tip amount → `TIP_LIABILITY` system account (2310 Tips Payable) via `POS_TIP` journal
- Kitchen tickets linked to `posOrderId` / `diningTableId` (auto-open on checkout)
- Night audit preview + close (`/pos/night-audit`)
- Recipes: use existing **GROUP** item BOM for fire-on-sale; AssemblyBuild for prep batches

### Hotel
- Room types, rooms, housekeeping (`/hospitality/rooms`)
- Check-in → stay + folio; charges; check-out → sales **INVOICE** (`/hospitality/stays`)
- Occupancy % on hospitality hub

### Packs
- `restaurant` and `hotel` packs marked `verticalStatus: 'ready'`

## Explicitly out
- IoT kitchen printers, OTA/channel manager, full Opera PMS

## Verify
```bash
pnpm exec vitest run tests/hospitality tests/packs
```
