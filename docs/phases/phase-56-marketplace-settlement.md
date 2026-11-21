# Phase 56 — Marketplace settlement

**Status:** Complete (FULL)

## Shipped

1. `MarketplaceSeller`, `SettlementBatch`, `SalesDocumentLine.sellerVendorId`.
2. `settlePeriod` journals + UI `/sales/settlements`.
3. **Deepen (2026-11-15)** — Settlement posts Dr `UNDEPOSITED_FUNDS` (gross), Cr `COMMISSION_INCOME`, Cr `COMMISSION_PAYABLE` — no uncategorised accounts.
4. **Wave E (2026-11-21)** — Per-seller statement; settle creates a vendor bill (and optional bill payment) per seller.

## Migration

`20261114220000_phase51_60_wave_cd`

Wave E: `20261121201000_wave_e_deepen` (`settlement_seller_lines`)
