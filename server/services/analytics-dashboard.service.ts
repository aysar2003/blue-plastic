import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import {
  addMonths,
  clockInZone,
  endOfMonth,
  formatDate,
  startOfMonth,
  toDate,
  today,
  type CalendarDate,
} from '@/lib/date'
import { isModuleEnabled } from '@/lib/feature-flags'
import {
  buildAnalyticsBrief,
  dailyCandlesFromTotals,
  weeklyCandlesFromDaily,
  type AnalyticsBrief,
} from '@/lib/analytics-brief'
import {
  resolveAnalyticsPeriod,
  type AnalyticsPeriodSelection,
} from '@/lib/analytics-period'
import { Decimal, formatMoney, toMoneyString, ZERO } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { profitAndLoss } from '@/server/reports/statements'
import { bankAccounts } from '@/server/services/banking.service'
import * as erpHome from '@/server/services/erp-home.service'
import * as inventoryService from '@/server/services/inventory.service'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type AnalyticsKpi = {
  key: string
  label: string
  value: string
  hint?: string
  href: string
  tone?: 'up' | 'down' | 'flat'
  spark?: number[]
}

export type AnalyticsOverview = {
  now: CalendarDate
  year: string
  month: string
  lastMonth: { from: CalendarDate; to: CalendarDate }
  priorMonth: { from: CalendarDate; to: CalendarDate }
  cashMonths: { label: string; amount: string }[]
  banks: { id: string; name: string; balance: string; subtype: string }[]
  bankTotal: string
  profit: { net: string; income: string; expenses: string; change: string | null }
  spending: { total: string; costOfSales: string; other: string; change: string | null }
  invoices: {
    unpaid: string
    overdue: string
    paid: string
    notDeposited: string
    deposited: string
  }
  sales: { total: string; days: { day: CalendarDate; amount: string }[] }
}

export type AnalyticsDashboard = {
  overview: AnalyticsOverview
  selection: AnalyticsPeriodSelection
  brief: AnalyticsBrief
  currency: string
  kpis: AnalyticsKpi[]
  banks: { id: string; name: string; balance: string; subtype: string }[]
  topSalesDays: { day: string; amount: string }[]
  collections: {
    paid: string
    deposited: string
    notDeposited: string
    depositedShare: number
  }
  profitSplit: { income: string; expenses: string; net: string }
  extras: {
    unpaidAp: string
    pipelineAmount: string
    pipelineCount: number
    followUps: number
    reorderCount: number | null
  }
  metricRows: { key: string; label: string; value: string; unit: string }[]
}

function changePercent(current: Decimal, prior: Decimal): string | null {
  if (prior.isZero()) return current.isZero() ? '0' : null
  return current.minus(prior).dividedBy(prior.abs()).times(100).toDecimalPlaces(0).toString()
}

function dayCount(from: CalendarDate, to: CalendarDate) {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000) + 1
}

async function queryAnalyticsRange(
  orgId: string,
  timeZone: string,
  from: CalendarDate,
  to: CalendarDate,
  priorFrom: CalendarDate,
  priorTo: CalendarDate,
): Promise<AnalyticsOverview> {
  const now = today(timeZone)
  const nowTime = clockInZone(new Date(), timeZone)
  const days = dayCount(from, to)
  const bucket =
    days > 800 ? ('year' as const) : days > 92 ? ('month' as const) : ('day' as const)

  const cashFrom = startOfMonth(from)
  const cashTo = endOfMonth(to)

  const [movement, lastPnL, priorPnL, invoiceRow, paymentRow, salesRows] =
    await Promise.all([
      db.$queryRaw<{ month: string; movement: string }[]>`
        SELECT to_char(j.date, 'YYYY-MM') AS month,
               COALESCE(SUM(l.debit - l.credit), 0)::text AS movement
          FROM journal_lines l
          JOIN journals j ON j.id = l."journalId"
          JOIN ledger_accounts a ON a.id = l."accountId"
         WHERE l."orgId" = ${orgId}
           AND a.subtype IN ('BANK', 'UNDEPOSITED_FUNDS')
           AND j.status IN ('POSTED', 'REVERSED')
           AND j."isClosingEntry" = false
           AND j.date BETWEEN ${toDate(cashFrom)} AND ${toDate(cashTo)}
         GROUP BY 1
         ORDER BY 1
      `,
      profitAndLoss(orgId, { from, to, basis: 'accrual' }),
      profitAndLoss(orgId, { from: priorFrom, to: priorTo, basis: 'accrual' }),
      db.$queryRaw<{ unpaid: string; overdue: string }[]>`
        SELECT COALESCE(SUM(d.total - COALESCE(a.applied, 0)), 0)::text AS unpaid,
               COALESCE(SUM(CASE
                 WHEN d."excludeFromOverdue" THEN 0
                 WHEN d."promisedDate" IS NOT NULL AND d."promisedDate" < ${toDate(now)}
                   THEN d.total - COALESCE(a.applied, 0)
                 WHEN d."promisedDate" IS NULL AND c."balanceDate" IS NOT NULL AND (
                      c."balanceDate" < ${toDate(now)}
                      OR (c."balanceDate" = ${toDate(now)} AND c."balanceTime" IS NOT NULL AND c."balanceTime" <= ${nowTime})
                 ) THEN d.total - COALESCE(a.applied, 0)
                 WHEN d."promisedDate" IS NULL AND c."balanceDate" IS NULL AND c."agreementDate" IS NOT NULL
                      AND c."agreementDate" < ${toDate(now)}
                   THEN d.total - COALESCE(a.applied, 0)
                 WHEN d."promisedDate" IS NULL AND c."balanceDate" IS NULL AND c."agreementDate" IS NULL
                      AND d."dueDate" IS NOT NULL AND d."dueDate" < ${toDate(now)}
                   THEN d.total - COALESCE(a.applied, 0)
                 ELSE 0 END), 0)::text AS overdue
          FROM sales_documents d
          JOIN customers c ON c.id = d."customerId"
          LEFT JOIN (
            SELECT "invoiceId", SUM(amount) AS applied
              FROM sales_applications
             WHERE "orgId" = ${orgId}
             GROUP BY "invoiceId"
          ) a ON a."invoiceId" = d.id
         WHERE d."orgId" = ${orgId}
           AND d.type = 'INVOICE'
           AND d.status IN ('OPEN', 'PARTIAL')
           AND d."deletedAt" IS NULL
      `,
      db.$queryRaw<{ paid: string; undeposited: string; deposited: string }[]>`
        SELECT COALESCE(SUM(p.amount), 0)::text AS paid,
               COALESCE(SUM(CASE WHEN a.subtype = 'UNDEPOSITED_FUNDS' THEN p.amount ELSE 0 END), 0)::text AS undeposited,
               COALESCE(SUM(CASE WHEN a.subtype <> 'UNDEPOSITED_FUNDS' THEN p.amount ELSE 0 END), 0)::text AS deposited
          FROM customer_payments p
          JOIN ledger_accounts a ON a.id = p."depositAccountId"
         WHERE p."orgId" = ${orgId}
           AND p."deletedAt" IS NULL
           AND p.status NOT IN ('VOID', 'DRAFT')
           AND p.date BETWEEN ${toDate(from)} AND ${toDate(to)}
      `,
      bucket === 'day'
        ? db.$queryRaw<{ day: string; amount: string }[]>`
            SELECT to_char(d.date, 'YYYY-MM-DD') AS day,
                   COALESCE(SUM(CASE WHEN d.type IN ('CREDIT_MEMO', 'REFUND_RECEIPT') THEN -d.subtotal ELSE d.subtotal END), 0)::text AS amount
              FROM sales_documents d
             WHERE d."orgId" = ${orgId}
               AND d."deletedAt" IS NULL
               AND d.status NOT IN ('DRAFT', 'VOID')
               AND d.type IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
               AND d.date BETWEEN ${toDate(from)} AND ${toDate(to)}
             GROUP BY d.date
             ORDER BY d.date
          `
        : bucket === 'month'
          ? db.$queryRaw<{ day: string; amount: string }[]>`
              SELECT to_char(date_trunc('month', d.date), 'YYYY-MM-DD') AS day,
                     COALESCE(SUM(CASE WHEN d.type IN ('CREDIT_MEMO', 'REFUND_RECEIPT') THEN -d.subtotal ELSE d.subtotal END), 0)::text AS amount
                FROM sales_documents d
               WHERE d."orgId" = ${orgId}
                 AND d."deletedAt" IS NULL
                 AND d.status NOT IN ('DRAFT', 'VOID')
                 AND d.type IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
                 AND d.date BETWEEN ${toDate(from)} AND ${toDate(to)}
               GROUP BY 1
               ORDER BY 1
            `
          : db.$queryRaw<{ day: string; amount: string }[]>`
              SELECT to_char(date_trunc('year', d.date), 'YYYY-MM-DD') AS day,
                     COALESCE(SUM(CASE WHEN d.type IN ('CREDIT_MEMO', 'REFUND_RECEIPT') THEN -d.subtotal ELSE d.subtotal END), 0)::text AS amount
                FROM sales_documents d
               WHERE d."orgId" = ${orgId}
                 AND d."deletedAt" IS NULL
                 AND d.status NOT IN ('DRAFT', 'VOID')
                 AND d.type IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
                 AND d.date BETWEEN ${toDate(from)} AND ${toDate(to)}
               GROUP BY 1
               ORDER BY 1
            `,
    ])

  const byMonth = new Map(movement.map((row) => [row.month, new Decimal(row.movement)]))
  const cashMonths: { label: string; amount: string }[] = []
  // Long ranges (All dates / multi-year): chart the last 24 months ending at `to`.
  let cursor = days > 400 ? startOfMonth(addMonths(endOfMonth(to), -23)) : cashFrom
  if (cursor < cashFrom) cursor = cashFrom
  let guard = 0
  while (cursor <= cashTo && guard < 36) {
    const key = cursor.slice(0, 7)
    const [y, m] = key.split('-')
    cashMonths.push({
      label: days > 400 ? key : `${MONTH_LABELS[Number(m) - 1]} ${y?.slice(2)}`,
      amount: toMoneyString(byMonth.get(key) ?? ZERO, 2),
    })
    cursor = startOfMonth(addMonths(cursor, 1))
    guard += 1
  }

  const section = (report: typeof lastPnL, key: string) =>
    report.sections.find((item) => item.key === key)?.total ?? ZERO

  const spending = section(lastPnL, 'cogs').plus(section(lastPnL, 'expenses')).plus(section(lastPnL, 'otherExpense'))
  const costOfSales = section(lastPnL, 'cogs')
  const otherExpense = spending.minus(costOfSales)
  const invoices = invoiceRow[0] ?? { unpaid: '0', overdue: '0' }
  const payments = paymentRow[0] ?? { paid: '0', undeposited: '0', deposited: '0' }
  const salesTotal = salesRows.reduce((sum, day) => sum.plus(day.amount), ZERO)

  return {
    now,
    year: to.slice(0, 4),
    month: from.slice(0, 7),
    lastMonth: { from, to },
    priorMonth: { from: priorFrom, to: priorTo },
    cashMonths,
    banks: [],
    bankTotal: '0.00',
    profit: {
      net: toMoneyString(lastPnL.netIncome, 2),
      income: toMoneyString(lastPnL.totalIncome, 2),
      expenses: toMoneyString(
        lastPnL.totalCogs.plus(lastPnL.totalOperatingExpenses).plus(section(lastPnL, 'otherExpense')),
        2,
      ),
      change: changePercent(lastPnL.netIncome, priorPnL.netIncome),
    },
    spending: {
      total: toMoneyString(spending, 2),
      costOfSales: toMoneyString(costOfSales, 2),
      other: toMoneyString(otherExpense, 2),
      change: changePercent(
        spending,
        section(priorPnL, 'cogs')
          .plus(section(priorPnL, 'expenses'))
          .plus(section(priorPnL, 'otherExpense')),
      ),
    },
    invoices: {
      unpaid: toMoneyString(invoices.unpaid, 2),
      overdue: toMoneyString(invoices.overdue, 2),
      paid: toMoneyString(payments.paid, 2),
      notDeposited: toMoneyString(payments.undeposited, 2),
      deposited: toMoneyString(payments.deposited, 2),
    },
    sales: {
      total: toMoneyString(salesTotal, 2),
      days: salesRows.map((day) => ({
        day: day.day as CalendarDate,
        amount: toMoneyString(day.amount, 2),
      })),
    },
  }
}

const cachedAnalyticsRange = cache(
  (
    orgId: string,
    timeZone: string,
    from: string,
    to: string,
    priorFrom: string,
    priorTo: string,
  ) =>
    unstable_cache(
      () =>
        queryAnalyticsRange(
          orgId,
          timeZone,
          from as CalendarDate,
          to as CalendarDate,
          priorFrom as CalendarDate,
          priorTo as CalendarDate,
        ),
      ['analytics-range-v1', orgId, timeZone, from, to, priorFrom, priorTo],
      { revalidate: 60 },
    )(),
)

export async function loadAnalyticsDashboard(
  ctx: OrgContext,
  params?: {
    period?: string | null
    from?: string | null
    to?: string | null
    month?: string | null
  },
): Promise<AnalyticsDashboard> {
  assertPermission(ctx, 'report:overview')
  const showReorder =
    isModuleEnabled(ctx.features, 'inventory') && ctx.permissions.has('inventory:read')

  const selection = resolveAnalyticsPeriod({
    period: params?.period,
    from: params?.from,
    to: params?.to,
    month: params?.month,
    timeZone: ctx.organization.timeZone,
    fiscalYearStartMonth: ctx.organization.fiscalYearStartMonth,
  })

  const [overviewRaw, banksRaw, extras, reorder] = await Promise.all([
    cachedAnalyticsRange(
      ctx.orgId,
      ctx.organization.timeZone,
      selection.range.from,
      selection.range.to,
      selection.prior.from,
      selection.prior.to,
    ),
    bankAccounts(ctx).catch(() => []),
    erpHome.homeExtras(ctx).catch(() => erpHome.extrasOrZero()),
    showReorder
      ? inventoryService.listStockAlerts(ctx).catch(() => ({ total: 0, alerts: [] }))
      : Promise.resolve({ total: 0, alerts: [] as { itemId: string }[] }),
  ])

  const bankList = banksRaw
    .filter((account) => account.subtype === 'BANK' || account.subtype === 'UNDEPOSITED_FUNDS')
    .map((account) => ({
      id: account.id,
      name: account.name,
      balance: toMoneyString(account.balance, 2),
      subtype: account.subtype,
    }))
  const overview: AnalyticsOverview = {
    ...overviewRaw,
    banks: bankList,
    bankTotal: toMoneyString(
      bankList.reduce((sum, account) => sum.plus(account.balance), ZERO),
      2,
    ),
  }

  const currency = ctx.organization.baseCurrency
  const candlesDaily = dailyCandlesFromTotals(overview.sales.days)
  const candlesWeekly = weeklyCandlesFromDaily(candlesDaily)
  const periodLabel =
    selection.key === 'custom'
      ? `${formatDate(selection.range.from)} – ${formatDate(selection.range.to)}`
      : selection.label

  const brief = buildAnalyticsBrief({
    org: {
      id: ctx.orgId,
      name: ctx.organization.name,
      currency,
      timeZone: ctx.organization.timeZone,
    },
    period: {
      month: overview.month,
      from: overview.lastMonth.from,
      to: overview.lastMonth.to,
      label: periodLabel,
    },
    currency,
    profit: overview.profit,
    bankTotal: overview.bankTotal,
    cashMonths: overview.cashMonths,
    invoices: overview.invoices,
    spending: overview.spending,
    sales: overview.sales,
    candlesDaily,
    candlesWeekly,
  })

  brief.metrics.unpaidAp = {
    label: 'Unpaid bills',
    value: extras.unpaidAp,
    unit: 'money',
  }
  brief.metrics.pipeline = {
    label: 'Open pipeline',
    value: extras.pipelineAmount,
    unit: 'money',
  }
  brief.metrics.followUps = {
    label: 'Open follow-ups',
    value: String(extras.followUps),
    unit: 'count',
  }
  if (showReorder) {
    brief.metrics.reorder = {
      label: 'Products to reorder',
      value: String(reorder.total),
      unit: 'count',
    }
  }

  const changeTone = (change: string | null): 'up' | 'down' | 'flat' | undefined => {
    if (change == null) return undefined
    const n = Number(change)
    if (n > 0) return 'up'
    if (n < 0) return 'down'
    return 'flat'
  }

  const periodQuery = `period=custom&from=${overview.lastMonth.from}&to=${overview.lastMonth.to}`
  const unpaid = new Decimal(overview.invoices.unpaid)
  const overdue = new Decimal(overview.invoices.overdue)
  const overdueShare = unpaid.isZero()
    ? 0
    : Math.min(100, overdue.dividedBy(unpaid).times(100).toNumber())
  const paid = new Decimal(overview.invoices.paid)
  const deposited = new Decimal(overview.invoices.deposited)
  const depositedShare = paid.isZero()
    ? 0
    : Math.min(100, deposited.dividedBy(paid).times(100).toNumber())

  const salesSpark = overview.sales.days.map((day) => Number(day.amount))
  const cashSpark = overview.cashMonths.map((month) => Number(month.amount))
  const candleSpark = candlesDaily.map((candle) => Number(candle.close))

  const kpis: AnalyticsKpi[] = [
    {
      key: 'profitNet',
      label: 'Profit',
      value: formatMoney(overview.profit.net, currency),
      hint: overview.profit.change != null ? `${overview.profit.change}% vs prior` : undefined,
      href: `/reports/profit-loss?${periodQuery}`,
      tone: changeTone(overview.profit.change),
      spark: candleSpark,
    },
    {
      key: 'salesTotal',
      label: 'Sales',
      value: formatMoney(overview.sales.total, currency),
      hint: `${overview.sales.days.length} points`,
      href: '/sales/invoices',
      spark: salesSpark,
    },
    {
      key: 'income',
      label: 'Income',
      value: formatMoney(overview.profit.income, currency),
      href: `/reports/profit-loss?${periodQuery}`,
      spark: salesSpark,
    },
    {
      key: 'expenses',
      label: 'Expenses',
      value: formatMoney(overview.profit.expenses, currency),
      href: `/reports/profit-loss?${periodQuery}`,
      spark: cashSpark.map((v) => Math.abs(v)),
    },
    {
      key: 'openAr',
      label: 'Customers still owe',
      value: formatMoney(overview.invoices.unpaid, currency),
      hint: overdueShare > 0 ? `${Math.round(overdueShare)}% overdue` : undefined,
      href: '/reports/ar-aging',
      tone: overdueShare >= 20 ? 'down' : undefined,
    },
    {
      key: 'bankTotal',
      label: 'Bank total',
      value: formatMoney(overview.bankTotal, currency),
      hint: `${overview.banks.length} accounts`,
      href: '/banking/accounts',
      spark: cashSpark,
    },
    {
      key: 'collected',
      label: 'Collected',
      value: formatMoney(overview.invoices.paid, currency),
      hint:
        Number(overview.invoices.notDeposited) > 0
          ? `${formatMoney(overview.invoices.notDeposited, currency)} undeposited`
          : undefined,
      href: '/payments',
      spark: salesSpark,
    },
  ]

  if (Number(overview.invoices.overdue) > 0) {
    kpis.push({
      key: 'overdue',
      label: 'Overdue AR',
      value: formatMoney(overview.invoices.overdue, currency),
      href: '/reports/ar-aging',
      tone: 'down',
    })
  }
  kpis.push(
    {
      key: 'unpaidAp',
      label: 'Unpaid bills',
      value: formatMoney(extras.unpaidAp, currency),
      href: '/reports/ap-aging',
      tone: Number(extras.unpaidAp) > 0 ? 'down' : 'flat',
    },
    {
      key: 'pipeline',
      label: 'Pipeline',
      value: formatMoney(extras.pipelineAmount, currency),
      hint: extras.pipelineCount ? `${extras.pipelineCount} deals` : undefined,
      href: '/customers/pipeline',
    },
    {
      key: 'spending',
      label: 'Spending',
      value: formatMoney(overview.spending.total, currency),
      hint: overview.spending.change != null ? `${overview.spending.change}% vs prior` : undefined,
      href: `/reports/profit-loss?${periodQuery}`,
      spark: cashSpark.map((v) => Math.abs(v)),
    },
  )

  if (showReorder) {
    kpis.push({
      key: 'reorder',
      label: 'To reorder',
      value: String(reorder.total),
      href: '/reports/inventory-reorder',
      tone: reorder.total > 0 ? 'down' : 'flat',
    })
  }

  const topSalesDays = [...overview.sales.days]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 8)
    .map((row) => ({ day: row.day, amount: row.amount }))

  const metricRows = Object.entries(brief.metrics).map(([key, metric]) => ({
    key,
    label: metric.label,
    value:
      metric.unit === 'money'
        ? formatMoney(metric.value, currency)
        : metric.unit === 'percent'
          ? `${metric.value}%`
          : metric.value,
    unit: metric.unit,
  }))

  return {
    overview,
    selection,
    brief,
    currency,
    kpis,
    banks: overview.banks,
    topSalesDays,
    collections: {
      paid: toMoneyString(paid, 2),
      deposited: toMoneyString(deposited, 2),
      notDeposited: overview.invoices.notDeposited,
      depositedShare,
    },
    profitSplit: {
      income: overview.profit.income,
      expenses: overview.profit.expenses,
      net: overview.profit.net,
    },
    extras: {
      unpaidAp: extras.unpaidAp,
      pipelineAmount: extras.pipelineAmount,
      pipelineCount: extras.pipelineCount,
      followUps: extras.followUps,
      reorderCount: showReorder ? reorder.total : null,
    },
    metricRows,
  }
}
