# Phase 36 — Subscriptions & recurring revenue

**Status:** Complete

**Exit:** SaaS / membership / rentals post correctly — AR bill schedules + deferred revenue lite.

## Shipped

1. **AR bill schedules** — `RecurringDocType.INVOICE` on `RecurringTemplate`. Create due / cron posts customer invoices via `salesService.create`. UI at `/sales/subscriptions`.
2. **Deferred revenue lite** — optional `deferRevenue` + `serviceMonths` on invoice schedules. After each invoice: reclass income → `UNEARNED_REVENUE`, open `DeferredRevenueSchedule`, then monthly recognition journals (Dr unearned / Cr income). Create due also runs recognition.
3. **System account** — `UNEARNED_REVENUE` (chart `2320`) + Settings default-accounts role.
4. Banking recurring UI stays purchase/journal only (`RECURRING_PURCHASE_TYPES`).

## Migration

`20261111220000_phase36_subscriptions`

## Explicitly out

Phases 37–40, ASC 606 full, metered usage, dunning, portal self-serve, platform `rentExpiresAt` billing.

## Verify

```bash
pnpm exec vitest run tests/deferred-revenue tests/recurring-create-due
pnpm exec prisma migrate deploy
```
