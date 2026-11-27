import 'server-only'

import {
  addMonths,
  endOfMonth,
  isCalendarDate,
  startOfMonth,
  toCalendarDate,
  toDate,
  today,
  type CalendarDate,
} from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { profitAndLoss } from '@/server/reports/statements'
import { expensesByCategory, salesByCustomer, salesByItem } from '@/server/reports/business'
import { bankAccounts } from '@/server/services/banking.service'
import * as receivables from '@/server/services/receivables.service'

/**
 * Company Snapshot — QuickBooks Company Centre parity, hardened and modern.
 *
 * Security / stability:
 * - `report:overview` required
 * - every query org-scoped
 * - widgets isolated (one failure never blanks the page)
 * - list caps; customer IDs validated + owned-by-org check (no IDOR)
 * - UI never sees raw exception text
 */

export const SNAPSHOT_TABS = ['company', 'payments', 'customer'] as const
export type SnapshotTab = (typeof SNAPSHOT_TABS)[number]

export function isSnapshotTab(value: string | undefined | null): value is SnapshotTab {
  return SNAPSHOT_TABS.includes(value as SnapshotTab)
}

const OWE_LIMIT = 25
const RECENT_LIMIT = 15
const TOP_LIMIT = 8
const ACCOUNT_LIMIT = 12
const EXPENSE_LIMIT = 8
const CUSTOMER_PICKER_LIMIT = 400
const EXPENSE_YEAR_SPAN = 6

export type WidgetOk<T> = { ok: true; data: T }
export type WidgetErr = { ok: false; error: string }
export type WidgetResult<T> = WidgetOk<T> | WidgetErr

export function widgetOk<T>(data: T): WidgetOk<T> {
  return { ok: true, data }
}

export function widgetErr(error: string): WidgetErr {
  return { ok: false, error }
}

async function safeWidget<T>(label: string, run: () => Promise<T>): Promise<WidgetResult<T>> {
  try {
    return widgetOk(await run())
  } catch (cause) {
    console.error(`[company-snapshot] ${label}`, cause instanceof Error ? cause.message : cause)
    return widgetErr('This panel could not load. Try again in a moment.')
  }
}

export type MoneyRow = {
  id: string
  name: string
  amount: string
  dueDate?: string | null
  overdue?: boolean
}
export type NamedAmount = { id: string; name: string; amount: string; count?: number }
export type MonthBar = { label: string; income: string; expense: string }
export type QuarterBar = { label: string; thisYear: string; lastYear: string }
export type YearBar = { label: string; amount: string }
export type AgingSlice = { key: string; label: string; amount: string }
export type RecentTxn = {
  id: string
  kind: string
  number: string
  date: string
  party: string
  amount: string
  href: string
}

export type SnapshotPulse = {
  cash: string
  openAr: string
  overdue: string
  paidMtd: string
  netMtd: string
  incomeMtd: string
  expenseMtd: string
  stockValue: string
  openJobs: string
  vanStock: string
}

export type CompanyBoard = {
  incomeExpense: WidgetResult<{ months: MonthBar[]; year: string }>
  incomeYoY: WidgetResult<{ quarters: QuarterBar[]; thisYear: string; lastYear: string }>
  expenseYoY: WidgetResult<{ years: YearBar[] }>
  accountBalances: WidgetResult<NamedAmount[]>
  customersWhoOwe: WidgetResult<MoneyRow[]>
  topCustomers: WidgetResult<NamedAmount[]>
  expenseBreakdown: WidgetResult<{ rows: NamedAmount[]; total: string }>
}

export type PaymentsBoard = {
  paymentStatus: WidgetResult<{
    paid: string
    unpaid: string
    overdue: string
    total: string
    label: string
  }>
  arAging: WidgetResult<{
    slices: AgingSlice[]
    grandTotal: string
    asOf: CalendarDate
    agrees: boolean
  }>
  recentTransactions: WidgetResult<RecentTxn[]>
  customersWhoOwe: WidgetResult<MoneyRow[]>
  reminders: WidgetResult<{
    overdueCount: number
    overdueAmount: string
    openInvoiceCount: number
    openInvoiceAmount: string
    draftCount: number
    draftAmount: string
  }>
}

export type CustomerBoard = {
  picker: WidgetResult<{ id: string; name: string; balanceHint?: string }[]>
  profile: WidgetResult<{
    id: string
    name: string
    yearsLabel: string
    averageDaysToPay: string | null
    openBalance: string
    creditLimit: string | null
    salesLastYear: string
    salesThisYear: string
    invoiceCount: number
    paymentCount: number
  } | null>
  recentInvoices: WidgetResult<
    {
      id: string
      number: string
      date: string
      dueDate: string | null
      amount: string
      openBalance: string
      href: string
    }[]
  >
  recentPayments: WidgetResult<
    { id: string; number: string; date: string; amount: string; href: string }[]
  >
  salesHistory: WidgetResult<NamedAmount[]>
  bestItems: WidgetResult<NamedAmount[]>
}

export type CompanySnapshot = {
  tab: SnapshotTab
  asOf: CalendarDate
  currency: string
  organizationName: string
  pulse: WidgetResult<SnapshotPulse>
  company: CompanyBoard | null
  payments: PaymentsBoard | null
  customer: CustomerBoard | null
  customerId: string | null
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function publicErrorMessage(): string {
  return 'This panel could not load. Try again in a moment.'
}

/** Reject forged ids without throwing (customer tab stays usable). */
export function looksLikeId(value: string | undefined | null): value is string {
  if (!value) return false
  return /^[a-z0-9_-]{8,64}$/i.test(value)
}

export async function loadCompanySnapshot(
  ctx: OrgContext,
  options: {
    tab?: string | null
    customerId?: string | null
    /** Point-in-time for balances and MTD windows. Defaults to org today. */
    asOf?: CalendarDate | string | null
  } = {},
): Promise<CompanySnapshot> {
  assertPermission(ctx, 'report:overview')

  const tab: SnapshotTab = isSnapshotTab(options.tab) ? options.tab : 'company'
  const asOf =
    options.asOf && isCalendarDate(options.asOf)
      ? options.asOf
      : today(ctx.organization.timeZone)
  const customerId = looksLikeId(options.customerId) ? options.customerId : null

  const pulse = await safeWidget('pulse', () => loadPulse(ctx, asOf))

  const base = {
    tab,
    asOf,
    currency: ctx.organization.baseCurrency,
    organizationName: ctx.organization.name,
    pulse,
    company: null as CompanyBoard | null,
    payments: null as PaymentsBoard | null,
    customer: null as CustomerBoard | null,
    customerId,
  }

  if (tab === 'company') {
    return { ...base, company: await loadCompanyBoard(ctx, asOf) }
  }
  if (tab === 'payments') {
    return { ...base, payments: await loadPaymentsBoard(ctx, asOf) }
  }
  return { ...base, customer: await loadCustomerBoard(ctx, asOf, customerId) }
}

async function loadPulse(ctx: OrgContext, asOf: CalendarDate): Promise<SnapshotPulse> {
  const monthStart = startOfMonth(asOf)
  const monthEnd = endOfMonth(asOf)

  const [banks, status, pnl, extras] = await Promise.all([
    bankAccounts(ctx),
    loadPaymentStatus(ctx.orgId, monthStart, monthEnd, asOf),
    profitAndLoss(ctx.orgId, { from: monthStart, to: monthEnd, basis: 'accrual' }),
    loadSnapshotExtras(ctx.orgId),
  ])

  const cash = banks
    .filter((a) => a.subtype === 'BANK' || a.subtype === 'UNDEPOSITED_FUNDS')
    .reduce((sum, a) => sum.plus(a.balance), ZERO)

  return {
    cash: toMoneyString(cash, 2),
    openAr: status.unpaid,
    overdue: status.overdue,
    paidMtd: status.paid,
    netMtd: toMoneyString(pnl.netIncome, 2),
    incomeMtd: toMoneyString(pnl.totalIncome, 2),
    expenseMtd: toMoneyString(
      pnl.totalCogs.plus(pnl.totalOperatingExpenses),
      2,
    ),
    stockValue: extras.stockValue,
    openJobs: extras.openJobs,
    vanStock: extras.vanStock,
  }
}

async function loadSnapshotExtras(orgId: string) {
  const { valuation } = await import('@/server/accounting/inventory')
  const { vanStockValue } = await import('@/lib/erp/snapshot-extras')
  const [stock, openJobs, vanStores] = await Promise.all([
    valuation(db, orgId).catch(() => ({ totalValue: ZERO, items: [] as { itemId: string; averageCost: Decimal }[] })),
    db.serviceJob.count({
      where: { orgId, status: { in: ['DRAFT', 'SCHEDULED'] } },
    }),
    db.store.findMany({
      where: { orgId, isActive: true, isVan: true },
      select: { id: true },
    }),
  ])
  let vanStock = ZERO
  if (vanStores.length > 0) {
    const groups = await db.inventoryTransaction.groupBy({
      by: ['itemId', 'storeId'],
      where: { orgId, storeId: { in: vanStores.map((row) => row.id) } },
      _sum: { quantity: true },
    })
    const average = new Map(stock.items.map((item) => [item.itemId, item.averageCost]))
    vanStock = vanStockValue(
      groups.map((row) => ({
        quantity: row._sum.quantity?.toString() ?? '0',
        averageCost: average.get(row.itemId) ?? ZERO,
      })),
    )
  }
  return {
    stockValue: toMoneyString(stock.totalValue, 2),
    openJobs: String(openJobs),
    vanStock: toMoneyString(vanStock, 2),
  }
}

async function loadCompanyBoard(ctx: OrgContext, asOf: CalendarDate): Promise<CompanyBoard> {
  const year = asOf.slice(0, 4)
  const yearStart = `${year}-01-01` as CalendarDate
  const yearEnd = `${year}-12-31` as CalendarDate
  const lastYear = String(Number(year) - 1)
  const quarterStart = startOfMonth(addMonths(startOfMonth(asOf), -2))

  const [
    incomeExpense,
    incomeYoY,
    expenseYoY,
    accountBalances,
    customersWhoOwe,
    topCustomers,
    expenseBreakdown,
  ] = await Promise.all([
    safeWidget('incomeExpense', () => loadIncomeExpenseTrend(ctx.orgId, yearStart, yearEnd, year)),
    safeWidget('incomeYoY', () => loadIncomeYoY(ctx.orgId, year, lastYear)),
    safeWidget('expenseYoY', () => loadExpenseYoY(ctx.orgId, year)),
    safeWidget('accountBalances', () => loadAccountBalances(ctx)),
    safeWidget('customersWhoOwe', () => loadCustomersWhoOwe(ctx, asOf)),
    safeWidget('topCustomers', async () => {
      const ranked = await salesByCustomer(ctx.orgId, { from: quarterStart, to: asOf })
      return ranked.rows.slice(0, TOP_LIMIT).map((row) => ({
        id: row.id,
        name: row.name,
        amount: toMoneyString(row.amount, 2),
        count: row.count,
      }))
    }),
    safeWidget('expenseBreakdown', async () => {
      const ranked = await expensesByCategory(ctx.orgId, { from: yearStart, to: asOf })
      return {
        rows: ranked.rows.slice(0, EXPENSE_LIMIT).map((row) => ({
          id: row.id,
          name: row.name,
          amount: toMoneyString(row.amount, 2),
          count: row.count,
        })),
        total: toMoneyString(ranked.total, 2),
      }
    }),
  ])

  return {
    incomeExpense,
    incomeYoY,
    expenseYoY,
    accountBalances,
    customersWhoOwe,
    topCustomers,
    expenseBreakdown,
  }
}

async function loadPaymentsBoard(ctx: OrgContext, asOf: CalendarDate): Promise<PaymentsBoard> {
  const monthStart = startOfMonth(asOf)
  const monthEnd = endOfMonth(asOf)

  const [paymentStatus, arAging, recentTransactions, customersWhoOwe, reminders] = await Promise.all([
    safeWidget('paymentStatus', () => loadPaymentStatus(ctx.orgId, monthStart, monthEnd, asOf)),
    safeWidget('arAging', async () => {
      const report = await receivables.aging(ctx, asOf)
      const slices: AgingSlice[] = receivables.AGING_BUCKETS.map((key) => ({
        key,
        label: receivables.BUCKET_LABELS[key],
        amount: toMoneyString(report.totals[key], 2),
      }))
      return {
        slices,
        grandTotal: toMoneyString(report.grandTotal, 2),
        asOf: report.asOf,
        agrees: report.agrees,
      }
    }),
    safeWidget('recentTransactions', () => loadRecentTransactions(ctx.orgId)),
    safeWidget('customersWhoOwe', () => loadCustomersWhoOwe(ctx, asOf)),
    safeWidget('reminders', () => loadReminders(ctx.orgId, asOf)),
  ])

  return { paymentStatus, arAging, recentTransactions, customersWhoOwe, reminders }
}

async function loadCustomerBoard(
  ctx: OrgContext,
  asOf: CalendarDate,
  customerId: string | null,
): Promise<CustomerBoard> {
  const year = asOf.slice(0, 4)
  const yearStart = `${year}-01-01` as CalendarDate
  const lastYearStart = `${Number(year) - 1}-01-01` as CalendarDate
  const lastYearEnd = `${Number(year) - 1}-12-31` as CalendarDate
  const historyFrom = startOfMonth(addMonths(startOfMonth(asOf), -11))

  const picker = await safeWidget('picker', async () => {
    const rows = await db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: CUSTOMER_PICKER_LIMIT,
    })
    return rows.map((row) => ({ id: row.id, name: row.displayName }))
  })

  if (!customerId) {
    return {
      picker,
      profile: widgetOk(null),
      recentInvoices: widgetOk([]),
      recentPayments: widgetOk([]),
      salesHistory: widgetOk([]),
      bestItems: widgetOk([]),
    }
  }

  const owned = await db.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
    select: {
      id: true,
      displayName: true,
      createdAt: true,
      creditLimit: true,
    },
  })

  if (!owned) {
    return {
      picker,
      profile: widgetOk(null),
      recentInvoices: widgetOk([]),
      recentPayments: widgetOk([]),
      salesHistory: widgetOk([]),
      bestItems: widgetOk([]),
    }
  }

  const [profile, recentInvoices, recentPayments, salesHistory, bestItems] = await Promise.all([
    safeWidget('profile', async () => {
      const [balanceRow, avgPay, salesLast, salesThis, invoiceCount, paymentCount] = await Promise.all([
        db.$queryRaw<{ balance: string }[]>`
          SELECT COALESCE(SUM(l.debit - l.credit), 0)::text AS balance
            FROM journal_lines l
            JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
            JOIN ledger_accounts a ON a.id = l."accountId"
           WHERE l."orgId" = ${ctx.orgId}
             AND l."customerId" = ${owned.id}
             AND a.subtype::text = 'ACCOUNTS_RECEIVABLE'
        `,
        averageDaysToPay(ctx.orgId, owned.id),
        salesByCustomer(ctx.orgId, { from: lastYearStart, to: lastYearEnd }, { customerId: owned.id }),
        salesByCustomer(ctx.orgId, { from: yearStart, to: asOf }, { customerId: owned.id }),
        db.salesDocument.count({
          where: {
            orgId: ctx.orgId,
            customerId: owned.id,
            type: 'INVOICE',
            status: { notIn: ['DRAFT', 'VOID', 'DECLINED'] },
            deletedAt: null,
          },
        }),
        db.customerPayment.count({
          where: {
            orgId: ctx.orgId,
            customerId: owned.id,
            status: { not: 'VOID' },
            deletedAt: null,
          },
        }),
      ])
      return {
        id: owned.id,
        name: owned.displayName,
        yearsLabel: tenureLabel(owned.createdAt, asOf),
        averageDaysToPay: avgPay,
        openBalance: toMoneyString(new Decimal(balanceRow[0]?.balance ?? '0'), 2),
        creditLimit: owned.creditLimit != null ? toMoneyString(owned.creditLimit, 2) : null,
        salesLastYear: toMoneyString(salesLast.total, 2),
        salesThisYear: toMoneyString(salesThis.total, 2),
        invoiceCount,
        paymentCount,
      }
    }),
    safeWidget('recentInvoices', async () => {
      const rows = await db.salesDocument.findMany({
        where: {
          orgId: ctx.orgId,
          customerId: owned.id,
          type: 'INVOICE',
          status: { notIn: ['DRAFT', 'VOID', 'DECLINED'] },
          deletedAt: null,
        },
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        take: RECENT_LIMIT,
        select: {
          id: true,
          number: true,
          date: true,
          dueDate: true,
          promisedDate: true,
          total: true,
          applications: { select: { amount: true } },
        },
      })
      return rows.map((row) => {
        const applied = row.applications.reduce((sum, app) => sum.plus(app.amount), ZERO)
        const open = new Decimal(row.total.toString()).minus(applied)
        const due = row.promisedDate ?? row.dueDate
        return {
          id: row.id,
          number: row.number,
          date: toCalendarDate(row.date),
          dueDate: due ? toCalendarDate(due) : null,
          amount: toMoneyString(row.total, 2),
          openBalance: toMoneyString(open.greaterThan(0) ? open : ZERO, 2),
          href: `/sales/invoices/${row.id}`,
        }
      })
    }),
    safeWidget('recentPayments', async () => {
      const rows = await db.customerPayment.findMany({
        where: {
          orgId: ctx.orgId,
          customerId: owned.id,
          status: { not: 'VOID' },
          deletedAt: null,
        },
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        take: RECENT_LIMIT,
        select: { id: true, number: true, date: true, amount: true },
      })
      return rows.map((row) => ({
        id: row.id,
        number: row.number,
        date: toCalendarDate(row.date),
        amount: toMoneyString(row.amount, 2),
        href: `/payments/${row.id}`,
      }))
    }),
    safeWidget('salesHistory', async () => {
      const rows = await db.$queryRaw<{ month: string; amount: string }[]>`
        SELECT to_char(d.date, 'YYYY-MM') AS month,
               COALESCE(SUM(CASE
                 WHEN d.type IN ('CREDIT_MEMO', 'REFUND_RECEIPT') THEN -d.subtotal
                 ELSE d.subtotal END), 0)::text AS amount
          FROM sales_documents d
         WHERE d."orgId" = ${ctx.orgId}
           AND d."customerId" = ${owned.id}
           AND d."deletedAt" IS NULL
           AND d.status NOT IN ('DRAFT', 'VOID')
           AND d.type IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
           AND d.date BETWEEN ${toDate(historyFrom)} AND ${toDate(asOf)}
         GROUP BY 1
         ORDER BY 1
      `
      return fillMonthSeries(historyFrom, asOf, rows)
    }),
    safeWidget('bestItems', async () => {
      const ranked = await salesByItem(ctx.orgId, { from: historyFrom, to: asOf }, {
        customerId: owned.id,
      })
      return ranked.rows.slice(0, TOP_LIMIT).map((row) => ({
        id: row.id,
        name: row.name,
        amount: toMoneyString(row.amount, 2),
        count: row.count,
      }))
    }),
  ])

  return { picker, profile, recentInvoices, recentPayments, salesHistory, bestItems }
}

/** Continuous month series so charts never look “broken” when a month is quiet. */
export function fillMonthSeries(
  from: CalendarDate,
  to: CalendarDate,
  rows: { month: string; amount: string }[],
): NamedAmount[] {
  const map = new Map(rows.map((row) => [row.month, row.amount]))
  const out: NamedAmount[] = []
  let cursor = startOfMonth(from)
  const end = startOfMonth(to)
  while (cursor <= end) {
    const key = cursor.slice(0, 7)
    out.push({
      id: key,
      name: `${MONTH_LABELS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`,
      amount: toMoneyString(map.get(key) ?? '0', 2),
    })
    cursor = startOfMonth(addMonths(cursor, 1))
  }
  return out
}

async function loadIncomeExpenseTrend(
  orgId: string,
  from: CalendarDate,
  to: CalendarDate,
  year: string,
) {
  const rows = await db.$queryRaw<{ month: string; income: string; expense: string }[]>`
    SELECT to_char(j.date, 'YYYY-MM') AS month,
           COALESCE(SUM(CASE WHEN a.type = 'INCOME' THEN l.credit - l.debit ELSE 0 END), 0)::text AS income,
           COALESCE(SUM(CASE WHEN a.type = 'EXPENSE' THEN l.debit - l.credit ELSE 0 END), 0)::text AS expense
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId"
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${orgId}
       AND j.status IN ('POSTED', 'REVERSED')
       AND j."isClosingEntry" = false
       AND j.date BETWEEN ${toDate(from)} AND ${toDate(to)}
       AND a.type IN ('INCOME', 'EXPENSE')
     GROUP BY 1
  `
  const byMonth = new Map(rows.map((row) => [row.month, row]))
  const months = MONTH_LABELS.map((label, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`
    const row = byMonth.get(key)
    return {
      label,
      income: toMoneyString(row?.income ?? '0', 2),
      expense: toMoneyString(row?.expense ?? '0', 2),
    }
  })
  return { months, year }
}

async function loadIncomeYoY(orgId: string, thisYear: string, lastYear: string) {
  const from = `${lastYear}-01-01` as CalendarDate
  const to = `${thisYear}-12-31` as CalendarDate
  const rows = await db.$queryRaw<{ year: string; quarter: number; income: string }[]>`
    SELECT to_char(j.date, 'YYYY') AS year,
           EXTRACT(QUARTER FROM j.date)::int AS quarter,
           COALESCE(SUM(l.credit - l.debit), 0)::text AS income
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId"
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${orgId}
       AND j.status IN ('POSTED', 'REVERSED')
       AND j."isClosingEntry" = false
       AND j.date BETWEEN ${toDate(from)} AND ${toDate(to)}
       AND a.type = 'INCOME'
     GROUP BY 1, 2
  `
  const key = (year: string, q: number) => `${year}-Q${q}`
  const map = new Map(rows.map((row) => [key(row.year, row.quarter), row.income]))
  const quarters = [1, 2, 3, 4].map((q) => ({
    label: `Q${q}`,
    thisYear: toMoneyString(map.get(key(thisYear, q)) ?? '0', 2),
    lastYear: toMoneyString(map.get(key(lastYear, q)) ?? '0', 2),
  }))
  return { quarters, thisYear, lastYear }
}

async function loadExpenseYoY(orgId: string, thisYear: string) {
  const startYear = Number(thisYear) - (EXPENSE_YEAR_SPAN - 1)
  const from = `${startYear}-01-01` as CalendarDate
  const to = `${thisYear}-12-31` as CalendarDate
  const rows = await db.$queryRaw<{ year: string; expense: string }[]>`
    SELECT to_char(j.date, 'YYYY') AS year,
           COALESCE(SUM(l.debit - l.credit), 0)::text AS expense
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId"
      JOIN ledger_accounts a ON a.id = l."accountId"
     WHERE l."orgId" = ${orgId}
       AND j.status IN ('POSTED', 'REVERSED')
       AND j."isClosingEntry" = false
       AND j.date BETWEEN ${toDate(from)} AND ${toDate(to)}
       AND a.type = 'EXPENSE'
     GROUP BY 1
     ORDER BY 1
  `
  const map = new Map(rows.map((row) => [row.year, row.expense]))
  const years: YearBar[] = []
  for (let y = startYear; y <= Number(thisYear); y += 1) {
    const label = String(y)
    years.push({ label, amount: toMoneyString(map.get(label) ?? '0', 2) })
  }
  return { years }
}

async function loadAccountBalances(ctx: OrgContext): Promise<NamedAmount[]> {
  const banks = await bankAccounts(ctx)
  const control = await db.$queryRaw<{ id: string; name: string; amount: string }[]>`
    SELECT a.id AS id,
           a.name AS name,
           COALESCE(SUM(CASE WHEN j.id IS NOT NULL THEN l.debit - l.credit ELSE 0 END), 0)::text AS amount
      FROM ledger_accounts a
      LEFT JOIN journal_lines l ON l."accountId" = a.id AND l."orgId" = ${ctx.orgId}
      LEFT JOIN journals j
        ON j.id = l."journalId"
       AND j.status NOT IN ('DRAFT', 'DELETED')
     WHERE a."orgId" = ${ctx.orgId}
       AND a."systemKey" IN ('ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'INVENTORY_ASSET')
     GROUP BY a.id, a.name
     ORDER BY a.name
  `

  const bankRows = banks
    .filter((account) => account.subtype === 'BANK' || account.subtype === 'UNDEPOSITED_FUNDS')
    .slice(0, ACCOUNT_LIMIT)
    .map((account) => ({
      id: account.id,
      name: account.name,
      amount: toMoneyString(account.balance, 2),
    }))

  const rest = control.map((row) => ({
    id: row.id,
    name: row.name,
    amount: toMoneyString(row.amount, 2),
  }))

  return [...bankRows, ...rest].slice(0, ACCOUNT_LIMIT)
}

async function loadCustomersWhoOwe(ctx: OrgContext, asOf: CalendarDate): Promise<MoneyRow[]> {
  const [report, dues] = await Promise.all([
    receivables.aging(ctx, asOf),
    db.$queryRaw<{ customerId: string; dueDate: Date | null }[]>`
      SELECT d."customerId" AS "customerId",
             MIN(COALESCE(d."promisedDate", d."dueDate")) AS "dueDate"
        FROM sales_documents d
       WHERE d."orgId" = ${ctx.orgId}
         AND d.type = 'INVOICE'
         AND d.status IN ('OPEN', 'PARTIAL')
         AND d."deletedAt" IS NULL
         AND (d.total - COALESCE((
               SELECT SUM(a.amount) FROM sales_applications a WHERE a."invoiceId" = d.id
             ), 0)) > 0
       GROUP BY d."customerId"
    `,
  ])
  const dueMap = new Map(
    dues.map((row) => [
      row.customerId,
      row.dueDate ? toCalendarDate(row.dueDate) : null,
    ]),
  )

  return report.rows
    .filter((row) => row.total.greaterThan(0))
    .sort((a, b) => b.total.comparedTo(a.total))
    .slice(0, OWE_LIMIT)
    .map((row) => {
      const dueDate = dueMap.get(row.customerId) ?? null
      return {
        id: row.customerId,
        name: row.customerName,
        amount: toMoneyString(row.total, 2),
        dueDate,
        overdue: dueDate != null && dueDate < asOf,
      }
    })
}

async function loadPaymentStatus(
  orgId: string,
  from: CalendarDate,
  to: CalendarDate,
  asOf: CalendarDate,
) {
  const [paidRow, openRow] = await Promise.all([
    db.$queryRaw<{ paid: string }[]>`
      SELECT COALESCE(SUM(p.amount), 0)::text AS paid
        FROM customer_payments p
       WHERE p."orgId" = ${orgId}
         AND p."deletedAt" IS NULL
         AND p.status NOT IN ('VOID', 'DRAFT')
         AND p.date BETWEEN ${toDate(from)} AND ${toDate(to)}
    `,
    db.$queryRaw<{ unpaid: string; overdue: string }[]>`
      SELECT COALESCE(SUM(d.total - COALESCE(a.applied, 0)), 0)::text AS unpaid,
             COALESCE(SUM(CASE
               WHEN d."excludeFromOverdue" THEN 0
               WHEN COALESCE(d."promisedDate", d."dueDate") < ${toDate(asOf)}
                 THEN d.total - COALESCE(a.applied, 0)
               ELSE 0 END), 0)::text AS overdue
        FROM sales_documents d
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
  ])

  const paid = new Decimal(paidRow[0]?.paid ?? '0')
  const unpaid = new Decimal(openRow[0]?.unpaid ?? '0')
  const overdue = new Decimal(openRow[0]?.overdue ?? '0')
  return {
    paid: toMoneyString(paid, 2),
    unpaid: toMoneyString(unpaid, 2),
    overdue: toMoneyString(overdue, 2),
    total: toMoneyString(paid.plus(unpaid), 2),
    label: `${MONTH_LABELS[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`,
  }
}

async function loadRecentTransactions(orgId: string): Promise<RecentTxn[]> {
  const [docs, pays] = await Promise.all([
    db.salesDocument.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ['DRAFT', 'VOID', 'DECLINED'] },
        type: { in: ['INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT'] },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: RECENT_LIMIT,
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        total: true,
        customer: { select: { displayName: true } },
      },
    }),
    db.customerPayment.findMany({
      where: { orgId, deletedAt: null, status: { notIn: ['VOID', 'DRAFT'] } },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: RECENT_LIMIT,
      select: {
        id: true,
        number: true,
        date: true,
        amount: true,
        customer: { select: { displayName: true } },
      },
    }),
  ])

  const typeHref: Record<string, string> = {
    INVOICE: 'invoices',
    SALES_RECEIPT: 'sales-receipts',
    CREDIT_MEMO: 'credit-memos',
    REFUND_RECEIPT: 'refunds',
  }

  const merged: Array<RecentTxn & { sort: number }> = [
    ...docs.map((row) => ({
      id: row.id,
      kind: row.type,
      number: row.number,
      date: toCalendarDate(row.date),
      party: row.customer.displayName,
      amount: toMoneyString(row.total, 2),
      href: `/sales/${typeHref[row.type] ?? 'invoices'}/${row.id}`,
      sort: row.date.getTime(),
    })),
    ...pays.map((row) => ({
      id: row.id,
      kind: 'PAYMENT',
      number: row.number,
      date: toCalendarDate(row.date),
      party: row.customer.displayName,
      amount: toMoneyString(row.amount, 2),
      href: `/payments/${row.id}`,
      sort: row.date.getTime(),
    })),
  ]

  return merged
    .sort((a, b) => b.sort - a.sort)
    .slice(0, RECENT_LIMIT)
    .map(({ sort: _sort, ...row }) => row)
}

async function loadReminders(orgId: string, asOf: CalendarDate) {
  const [openRows, draftRows] = await Promise.all([
    db.$queryRaw<
      { overdue_count: number; overdue_amount: string; open_count: number; open_amount: string }[]
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE NOT d."excludeFromOverdue"
            AND COALESCE(d."promisedDate", d."dueDate") < ${toDate(asOf)}
        )::int AS overdue_count,
        COALESCE(SUM(CASE
          WHEN NOT d."excludeFromOverdue"
           AND COALESCE(d."promisedDate", d."dueDate") < ${toDate(asOf)}
          THEN d.total - COALESCE(a.applied, 0) ELSE 0 END), 0)::text AS overdue_amount,
        COUNT(*)::int AS open_count,
        COALESCE(SUM(d.total - COALESCE(a.applied, 0)), 0)::text AS open_amount
        FROM sales_documents d
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
         AND (d.total - COALESCE(a.applied, 0)) > 0
    `,
    db.$queryRaw<{ draft_count: number; draft_amount: string }[]>`
      SELECT COUNT(*)::int AS draft_count,
             COALESCE(SUM(d.total), 0)::text AS draft_amount
        FROM sales_documents d
       WHERE d."orgId" = ${orgId}
         AND d."deletedAt" IS NULL
         AND d.status = 'DRAFT'
         AND d.type IN ('INVOICE', 'CREDIT_MEMO')
    `,
  ])

  const row = openRows[0]
  const draft = draftRows[0]
  return {
    overdueCount: row?.overdue_count ?? 0,
    overdueAmount: toMoneyString(row?.overdue_amount ?? '0', 2),
    openInvoiceCount: row?.open_count ?? 0,
    openInvoiceAmount: toMoneyString(row?.open_amount ?? '0', 2),
    draftCount: draft?.draft_count ?? 0,
    draftAmount: toMoneyString(draft?.draft_amount ?? '0', 2),
  }
}

async function averageDaysToPay(orgId: string, customerId: string): Promise<string | null> {
  const rows = await db.$queryRaw<{ avg_days: string | null }[]>`
    SELECT ROUND(AVG((p.date - d.date))::numeric, 2)::text AS avg_days
      FROM sales_applications a
      JOIN sales_documents d ON d.id = a."invoiceId"
      JOIN customer_payments p ON p.id = a."paymentId"
     WHERE a."orgId" = ${orgId}
       AND d."orgId" = ${orgId}
       AND p."orgId" = ${orgId}
       AND d."customerId" = ${customerId}
       AND d.type = 'INVOICE'
       AND d."deletedAt" IS NULL
       AND p."deletedAt" IS NULL
       AND p.status NOT IN ('VOID', 'DRAFT')
       AND a."paymentId" IS NOT NULL
  `
  const value = rows[0]?.avg_days
  if (value == null || value === '') return null
  return value
}

export function tenureLabel(createdAt: Date, asOf: CalendarDate): string {
  const start = toCalendarDate(createdAt)
  const startY = Number(start.slice(0, 4))
  const startM = Number(start.slice(5, 7))
  const asOfY = Number(asOf.slice(0, 4))
  const asOfM = Number(asOf.slice(5, 7))
  let months = (asOfY - startY) * 12 + (asOfM - startM)
  if (months < 0) months = 0
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years === 0) return rem === 1 ? '1 Month' : `${rem} Months`
  if (rem === 0) return years === 1 ? '1 Year' : `${years} Years`
  return `${years} Year${years === 1 ? '' : 's'}, ${rem} Month${rem === 1 ? '' : 's'}`
}

export function snapshotWidgetErrorText(cause: unknown): string {
  void cause
  return publicErrorMessage()
}
