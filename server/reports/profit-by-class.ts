import 'server-only'

import { toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { db } from '@/server/db'

export type ProfitByClassRow = {
  id: string | null
  name: string
  income: Decimal
  expense: Decimal
  netIncome: Decimal
}

/**
 * Profit and loss split by class.
 *
 * Income is credit minus debit on revenue accounts. Expense is debit minus
 * credit on cost of goods and expense accounts. A line with no class is
 * "Unclassified". Closing entries are left out, the same way the profit and
 * loss leaves them out.
 */
export async function profitByClass(
  orgId: string,
  range: { from: CalendarDate; to: CalendarDate },
): Promise<{ rows: ProfitByClassRow[]; income: Decimal; expense: Decimal; netIncome: Decimal }> {
  const from = toDate(range.from)
  const to = toDate(range.to)

  const raw = await db.$queryRaw<
    { id: string | null; name: string | null; income: unknown; expense: unknown }[]
  >`
    SELECT l."trackingCategoryId" AS id,
           c.name,
           SUM(CASE WHEN a.type = 'REVENUE' THEN l.credit - l.debit ELSE 0 END) AS income,
           SUM(CASE WHEN a.type IN ('COGS', 'EXPENSE') THEN l.debit - l.credit ELSE 0 END) AS expense
      FROM journal_lines l
      INNER JOIN journals j
        ON j.id = l."journalId"
       AND j.status NOT IN ('DRAFT', 'DELETED')
       AND j."isClosingEntry" = false
      INNER JOIN ledger_accounts a
        ON a.id = l."accountId"
       AND a.type IN ('REVENUE', 'COGS', 'EXPENSE')
      LEFT JOIN tracking_categories c
        ON c.id = l."trackingCategoryId"
     WHERE l."orgId" = ${orgId}
       AND l."journalDate" BETWEEN ${from} AND ${to}
     GROUP BY l."trackingCategoryId", c.name
     ORDER BY c.name NULLS LAST
  `

  const rows = raw.map((row) => {
    const income = new Decimal(String(row.income ?? 0))
    const expense = new Decimal(String(row.expense ?? 0))
    return {
      id: row.id,
      name: row.name ?? 'Unclassified',
      income,
      expense,
      netIncome: income.minus(expense),
    }
  })

  const income = rows.reduce((sum, row) => sum.plus(row.income), ZERO)
  const expense = rows.reduce((sum, row) => sum.plus(row.expense), ZERO)

  return { rows, income, expense, netIncome: income.minus(expense) }
}
