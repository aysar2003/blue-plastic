# Scale operations (LITE)

Operator notes for multi-tenant SME ERP at higher volume.

## Tenant partition

- **Hot path:** partition relational data by `orgId` (row-level tenancy already enforced in services).
- **Reports:** prefer read replicas or reporting DB fed by logical replication; never run heavy consol on the primary during close.
- **Files:** uploads keyed by org (`uploads/...`).

## Live ledger window

- Default **5** fiscal years stay in the hot ledger (`LIVE_FISCAL_YEARS` in `lib/year-archive.ts`).
- Older **closed** years: archive via **Periods → Archive & restore** (`year-archive.service`).
- Restore is newest-first; bridge journal keeps the balance sheet coherent.

## Archive cadence

1. Close fiscal year (P&amp;L → retained earnings).
2. Lock periods as usual.
3. Archive one year at a time from the periods page.
4. Scheduled report packs and KPI snapshots should target live years only.

## Read replica use

- AR/AP aging, group consolidation, portfolio rollups, commitment vs budget.
- Trial balance / P&amp;L for archived years: serve from object storage package when restored, or static pack export.