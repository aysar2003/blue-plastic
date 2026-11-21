# Phase 36 — Subscriptions & recurring revenue

**Status:** Complete (FULL) — Wave C 2026-11-21

**Exit:** SaaS / membership / rentals post correctly — AR bill schedules + deferred revenue lite + dunning.

## Shipped

1. **AR bill schedules** — `RecurringDocType.INVOICE` on `RecurringTemplate`. Create due / cron posts customer invoices via `salesService.create`. UI at `/sales/subscriptions`.
2. **Deferred revenue lite** — optional `deferRevenue` + `serviceMonths` on invoice schedules. After each invoice: reclass income → `UNEARNED_REVENUE`, open `DeferredRevenueSchedule`, then monthly recognition journals (Dr unearned / Cr income). Create due also runs recognition.
3. **System account** — `UNEARNED_REVENUE` (chart `2320`) + Settings default-accounts role.
4. Banking recurring UI stays purchase/journal only (`RECURRING_PURCHASE_TYPES`).
5. **Dunning (FULL)** — `/sales/subscriptions/dunning` lists overdue invoices for subscription customers + reminder email.
6. **Pause / resume / cancel** — pause stops new invoices; cancel sets `endOn` today and **clears remaining unearned** in one recognition journal.
7. **Portal upcoming invoices** — next scheduled bill on the portal invoices page.

## Migration

`20261111220000_phase36_subscriptions`

## Explicitly out

Phases 37–40, ASC 606 full, metered usage, platform `rentExpiresAt` billing.

## Verify

```bash
pnpm exec vitest run tests/deferred-revenue tests/recurring-create-due tests/wave-c-deepen
pnpm exec prisma migrate deploy
```
