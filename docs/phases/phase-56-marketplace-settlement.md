# Phase 56 — Marketplace settlement LITE

**Status:** Complete (LITE)

## Shipped

1. `MarketplaceSeller`, `SettlementBatch`, `SalesDocumentLine.sellerVendorId`.
2. `settlePeriod` journals + UI `/sales/settlements`.
3. **Deepen (2026-11-15)** — Settlement posts Dr `UNDEPOSITED_FUNDS` (gross), Cr `COMMISSION_INCOME`, Cr `COMMISSION_PAYABLE` — no uncategorised accounts.

## Migration

`20261114220000_phase51_60_wave_cd`