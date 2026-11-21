import 'server-only'

import { allocatePatronage, patronageCsv, patronageMemberCsvRows, type PatronageMember } from '@/lib/erp/patronage'
import { toDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { seedChartOfAccounts, systemAccountId } from '@/server/accounting/chart-of-accounts'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { validation } from '@/server/errors'
import * as journalService from '@/server/services/journal.service'

export async function allocate(ctx: OrgContext, year: number, percentOfNet: string) {
  assertPermission(ctx, 'journal:post')
  const pct = new Decimal(percentOfNet || 0)
  if (pct.lessThanOrEqualTo(0) || pct.greaterThan(100)) {
    throw validation('Percent of net must be between 0 and 100.')
  }

  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const [pl] = await db.$queryRaw<{ income: string; expense: string }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN a.type = 'INCOME' THEN l.credit - l.debit ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN a.type IN ('EXPENSE', 'COST_OF_GOODS_SOLD', 'OTHER_EXPENSE')
        THEN l.debit - l.credit ELSE 0 END), 0) AS expense
    FROM journal_lines l
    JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
    JOIN ledger_accounts a ON a.id = l."accountId"
    WHERE l."orgId" = ${ctx.orgId}
      AND j.date >= ${toDate(from)}::date
      AND j.date <= ${toDate(to)}::date
  `
  const net = new Decimal(pl?.income ?? 0).minus(new Decimal(pl?.expense ?? 0))

  const shareholders = await db.shareholder.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, name: true, memberKind: true, customerId: true },
  })

  const salesByCustomer = new Map<string, Decimal>()
  if (shareholders.some((s) => s.customerId)) {
    const invoices = await db.salesDocument.groupBy({
      by: ['customerId'],
      where: {
        orgId: ctx.orgId,
        type: 'INVOICE',
        deletedAt: null,
        date: { gte: toDate(from), lte: toDate(to) },
      },
      _sum: { total: true },
    })
    for (const row of invoices) {
      const customerId = row.customerId
      if (customerId) {
        salesByCustomer.set(
          customerId,
          new Decimal(row._sum?.total?.toString() ?? 0),
        )
      }
    }
  }

  const members: PatronageMember[] = shareholders.map((row) => ({
    shareholderId: row.id,
    name: row.name,
    memberKind: row.memberKind,
    customerId: row.customerId,
    weight: row.customerId ? salesByCustomer.get(row.customerId) ?? new Decimal(0) : new Decimal(0),
  }))

  const { pool, shares } = allocatePatronage(members, net, pct)

  await db.$transaction(async (tx) => seedChartOfAccounts(tx, ctx.orgId))
  const equityId = await db.$transaction((tx) => systemAccountId(tx, ctx.orgId, 'OPENING_BALANCE_EQUITY'))
  const expenseId = await db.$transaction((tx) => systemAccountId(tx, ctx.orgId, 'UNCATEGORISED_EXPENSE'))
  const journal = await journalService.createManual(ctx, {
    number: undefined,
    date: to,
    memo: `Patronage allocation ${year}`,
    isAdjusting: true,
    autoReverse: false,
    lines: [
      {
        accountId: expenseId,
        debit: pool,
        credit: '0',
        description: 'Patronage pool',
      },
      {
        accountId: equityId,
        debit: '0',
        credit: pool,
        description: 'Patronage to members',
      },
    ],
  })

  for (const share of shares) {
    if (new Decimal(share.amount).lessThanOrEqualTo(0)) continue
    await db.equityEvent.create({
      data: {
        orgId: ctx.orgId,
        kind: 'PATRONAGE',
        shareholderId: share.shareholderId,
        amount: share.amount,
        date: toDate(to),
        memo: `Patronage ${year} · ${share.name}`,
        bankAccountId: null,
        equityAccountId: equityId,
        journalId: journal.id,
      },
    })
  }

  return {
    year,
    netIncome: net.toFixed(4),
    percentOfNet: pct.toFixed(4),
    pool,
    shares,
    csv: patronageCsv(shares),
    memberCsvRows: patronageMemberCsvRows(shares),
  }
}

export async function memberCsv(ctx: OrgContext, year?: number) {
  assertPermission(ctx, 'account:read')
  const whereYear = year
    ? { date: { gte: toDate(`${year}-01-01`), lte: toDate(`${year}-12-31`) } }
    : {}
  const events = await db.equityEvent.findMany({
    where: { orgId: ctx.orgId, kind: 'PATRONAGE', ...whereYear },
    include: { shareholder: { select: { name: true } } },
    orderBy: { date: 'desc' },
    take: 500,
  })
  if (events.length === 0) return null
  return patronageMemberCsvRows(
    events.map((row) => ({
      shareholderId: row.shareholderId ?? '',
      name: row.shareholder?.name ?? '',
      amount: row.amount.toFixed(4),
      weight: '',
    })),
  )
}