import 'server-only'

import { addDays, addMonths, endOfMonth, startOfMonth, toDate, today, type CalendarDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { bankAccounts } from '@/server/services/banking.service'
import { profitAndLoss } from '@/server/reports/statements'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function changePercent(current: Decimal, prior: Decimal): string | null {
  if (prior.isZero()) return current.isZero() ? '0' : null
  return current.minus(prior).dividedBy(prior.abs()).times(100).toDecimalPlaces(0).toString()
}

/**
 * The business overview cards. Every figure is read from the ledger or from the
 * documents that posted to it.
 */
export async function businessOverview(ctx: OrgContext) {
  assertPermission(ctx, 'report:overview')
  const now = today(ctx.organization.timeZone)
  const year = now.slice(0, 4)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const lastMonthStart = startOfMonth(addMonths(startOfMonth(now), -1))
  const lastMonthEnd = endOfMonth(lastMonthStart)
  const priorMonthStart = startOfMonth(addMonths(lastMonthStart, -1))
  const priorMonthEnd = endOfMonth(priorMonthStart)
  const last30From = addDays(now, -29)
  const prior30To = addDays(last30From, -1)
  const prior30From = addDays(prior30To, -29)
  const last365From = addDays(now, -364)

  const [movement, lastPnL, priorPnL, recentPnL, priorRecentPnL, banks, invoiceRow, paymentRow, salesDays] =
    await Promise.all([
      db.$queryRaw<{ month: string; movement: string }[]>`
        SELECT to_char(j.date, 'YYYY-MM') AS month,
               COALESCE(SUM(l.debit - l.credit), 0)::text AS movement
          FROM journal_lines l
          JOIN journals j ON j.id = l."journalId"
          JOIN ledger_accounts a ON a.id = l."accountId"
         WHERE l."orgId" = ${ctx.orgId}
           AND a.subtype IN ('BANK', 'UNDEPOSITED_FUNDS')
           AND j.status IN ('POSTED', 'REVERSED')
           AND j."isClosingEntry" = false
           AND j.date BETWEEN ${toDate(yearStart)} AND ${toDate(yearEnd)}
         GROUP BY 1
      `,
      profitAndLoss(ctx.orgId, { from: lastMonthStart, to: lastMonthEnd, basis: 'accrual' }),
      profitAndLoss(ctx.orgId, { from: priorMonthStart, to: priorMonthEnd, basis: 'accrual' }),
      profitAndLoss(ctx.orgId, { from: last30From, to: now, basis: 'accrual' }),
      profitAndLoss(ctx.orgId, { from: prior30From, to: prior30To, basis: 'accrual' }),
      bankAccounts(ctx),
      db.$queryRaw<{ unpaid: string; overdue: string }[]>`
        SELECT COALESCE(SUM(d.total - COALESCE(a.applied, 0)), 0)::text AS unpaid,
               COALESCE(SUM(CASE WHEN d."dueDate" IS NOT NULL AND d."dueDate" < ${toDate(now)}
                                 THEN d.total - COALESCE(a.applied, 0) ELSE 0 END), 0)::text AS overdue
          FROM sales_documents d
          LEFT JOIN LATERAL (
            SELECT SUM(amount) AS applied FROM sales_applications WHERE "invoiceId" = d.id
          ) a ON true
         WHERE d."orgId" = ${ctx.orgId}
           AND d.type = 'INVOICE'
           AND d.status IN ('OPEN', 'PARTIAL')
           AND d."deletedAt" IS NULL
           AND d.date BETWEEN ${toDate(last365From)} AND ${toDate(now)}
      `,
      db.$queryRaw<{ paid: string; undeposited: string; deposited: string }[]>`
        SELECT COALESCE(SUM(p.amount), 0)::text AS paid,
               COALESCE(SUM(CASE WHEN a.subtype = 'UNDEPOSITED_FUNDS' THEN p.amount ELSE 0 END), 0)::text AS undeposited,
               COALESCE(SUM(CASE WHEN a.subtype <> 'UNDEPOSITED_FUNDS' THEN p.amount ELSE 0 END), 0)::text AS deposited
          FROM customer_payments p
          JOIN ledger_accounts a ON a.id = p."depositAccountId"
         WHERE p."orgId" = ${ctx.orgId}
           AND p."deletedAt" IS NULL
           AND p.status NOT IN ('VOID', 'DRAFT')
           AND p.date BETWEEN ${toDate(last30From)} AND ${toDate(now)}
      `,
      db.$queryRaw<{ day: string; amount: string }[]>`
        SELECT to_char(d.date, 'YYYY-MM-DD') AS day,
               COALESCE(SUM(CASE WHEN d.type IN ('CREDIT_MEMO', 'REFUND_RECEIPT') THEN -d.subtotal ELSE d.subtotal END), 0)::text AS amount
          FROM sales_documents d
         WHERE d."orgId" = ${ctx.orgId}
           AND d."deletedAt" IS NULL
           AND d.status NOT IN ('DRAFT', 'VOID')
           AND d.type IN ('INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT')
           AND d.date BETWEEN ${toDate(lastMonthStart)} AND ${toDate(lastMonthEnd)}
         GROUP BY d.date
         ORDER BY d.date
      `,
    ])

  const byMonth = new Map(movement.map((row) => [row.month, new Decimal(row.movement)]))
  const cashMonths = MONTHS.map((label, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`
    return { label, amount: toMoneyString(byMonth.get(key) ?? ZERO, 2) }
  })

  const section = (report: typeof lastPnL, key: string) =>
    report.sections.find((item) => item.key === key)?.total ?? ZERO

  const spending = section(recentPnL, 'cogs').plus(section(recentPnL, 'expenses')).plus(section(recentPnL, 'otherExpense'))
  const costOfSales = section(recentPnL, 'cogs')
  const otherExpense = spending.minus(costOfSales)

  const invoices = invoiceRow[0] ?? { unpaid: '0', overdue: '0' }
  const payments = paymentRow[0] ?? { paid: '0', undeposited: '0', deposited: '0' }
  const salesTotal = salesDays.reduce((sum, day) => sum.plus(day.amount), ZERO)

  const bankList = banks
    .filter((account) => account.subtype === 'BANK' || account.subtype === 'UNDEPOSITED_FUNDS')
    .map((account) => ({
      id: account.id,
      name: account.name,
      balance: toMoneyString(account.balance, 2),
      subtype: account.subtype,
    }))

  return {
    now,
    year,
    lastMonth: { from: lastMonthStart, to: lastMonthEnd },
    priorMonth: { from: priorMonthStart, to: priorMonthEnd },
    last30: { from: last30From, to: now },
    cashMonths,
    hasBank: banks.some((account) => account.subtype === 'BANK'),
    banks: bankList,
    bankTotal: toMoneyString(
      bankList.reduce((sum, account) => sum.plus(account.balance), ZERO),
      2,
    ),
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
        section(priorRecentPnL, 'cogs')
          .plus(section(priorRecentPnL, 'expenses'))
          .plus(section(priorRecentPnL, 'otherExpense')),
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
      days: salesDays.map((day) => ({ day: day.day as CalendarDate, amount: toMoneyString(day.amount, 2) })),
    },
  }
}
