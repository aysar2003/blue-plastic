import 'server-only'

import { toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { db } from '@/server/db'

export type CompanySnapshot = {
  id: string
  name: string
  legalName: string | null
  currency: string
  /** Null for a main / standalone company. */
  parentOrgId: string | null
  income: Decimal
  expenses: Decimal
  netIncome: Decimal
  receivable: Decimal
  payable: Decimal
  /** Bank + undeposited funds, as of the period end. */
  cash: Decimal
  /**
   * Balance-sheet equity: posted equity accounts plus unclosed profit and loss
   * through the period end (same idea as the equity total on the balance sheet).
   */
  equity: Decimal
  openingBalance: Decimal
  retainedEarnings: Decimal
}

export type CurrencyTotal = {
  currency: string
  income: Decimal
  expenses: Decimal
  netIncome: Decimal
  receivable: Decimal
  payable: Decimal
  cash: Decimal
  equity: Decimal
  openingBalance: Decimal
  retainedEarnings: Decimal
  companies: number
}

/**
 * One row per company, plus a total for each currency.
 *
 * Books are not converted. A dollar company and a shilling company stay in
 * their own total, the same way Odoo refuses to add mixed currencies into one
 * number. Income and expenses are the period's profit and loss (closing
 * entries left out). Receivable and payable are what is still open. Cash,
 * equity, opening balance, and retained earnings are balances as of the
 * period end.
 */
export async function companySnapshots(
  range: {
    from: CalendarDate
    to: CalendarDate
  },
  options?: {
    /** Limit to these companies. Omit or `'all'` for every organisation. */
    orgIds?: string[] | 'all'
  },
): Promise<{ rows: CompanySnapshot[]; totals: CurrencyTotal[] }> {
  const from = toDate(range.from)
  const to = toDate(range.to)

  const scope = options?.orgIds
  if (Array.isArray(scope) && scope.length === 0) {
    return { rows: [], totals: [] }
  }

  const companies = await db.organization.findMany({
    where: Array.isArray(scope) ? { id: { in: scope } } : undefined,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      legalName: true,
      baseCurrency: true,
      parentOrgId: true,
    },
  })

  const [figures, receivables, payables, balances] = await Promise.all([
    db.$queryRaw<{ orgId: string; income: string; expenses: string }[]>`
      SELECT l."orgId" AS "orgId",
             COALESCE(SUM(CASE
               WHEN a.subtype IN ('INCOME', 'SALES_DISCOUNTS', 'OTHER_INCOME')
               THEN -(l.debit - l.credit) ELSE 0 END), 0) AS income,
             COALESCE(SUM(CASE
               WHEN a.subtype IN ('COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'DEPRECIATION', 'OTHER_EXPENSE')
               THEN (l.debit - l.credit) ELSE 0 END), 0) AS expenses
        FROM journal_lines l
        JOIN journals j
          ON j.id = l."journalId"
         AND j.status NOT IN ('DRAFT', 'DELETED')
         AND j."isClosingEntry" = false
        JOIN ledger_accounts a ON a.id = l."accountId"
       WHERE l."journalDate" BETWEEN ${from} AND ${to}
       GROUP BY l."orgId"
    `,
    db.$queryRaw<{ orgId: string; outstanding: string }[]>`
      SELECT d."orgId" AS "orgId",
             COALESCE(SUM(d.total - COALESCE(a.applied, 0)), 0) AS outstanding
        FROM sales_documents d
        LEFT JOIN LATERAL (
          SELECT SUM(amount) AS applied
            FROM sales_applications
           WHERE "invoiceId" = d.id
        ) a ON true
       WHERE d.type = 'INVOICE'
         AND d.status IN ('OPEN', 'PARTIAL')
       GROUP BY d."orgId"
    `,
    db.$queryRaw<{ orgId: string; outstanding: string }[]>`
      SELECT d."orgId" AS "orgId",
             COALESCE(SUM(d.total - COALESCE(a.applied, 0)), 0) AS outstanding
        FROM purchase_documents d
        LEFT JOIN LATERAL (
          SELECT SUM(amount) AS applied
            FROM purchase_applications
           WHERE "billId" = d.id
        ) a ON true
       WHERE d.type = 'BILL'
         AND d.status IN ('OPEN', 'PARTIAL')
       GROUP BY d."orgId"
    `,
    db.$queryRaw<
      {
        orgId: string
        cash: string
        equity: string
        openingBalance: string
        retainedEarnings: string
      }[]
    >`
      SELECT l."orgId" AS "orgId",
             COALESCE(SUM(CASE
               WHEN a.subtype IN ('BANK', 'UNDEPOSITED_FUNDS')
               THEN (l.debit - l.credit) ELSE 0 END), 0) AS cash,
             COALESCE(SUM(CASE
               WHEN a.subtype IN (
                      'OWNERS_EQUITY', 'RETAINED_EARNINGS',
                      'OPENING_BALANCE_EQUITY', 'DRAWINGS'
                    )
                 OR a.type IN ('REVENUE', 'EXPENSE')
               THEN -(l.debit - l.credit) ELSE 0 END), 0) AS equity,
             COALESCE(SUM(CASE
               WHEN a.subtype = 'OPENING_BALANCE_EQUITY'
               THEN -(l.debit - l.credit) ELSE 0 END), 0) AS "openingBalance",
             COALESCE(SUM(CASE
               WHEN a.subtype = 'RETAINED_EARNINGS'
               THEN -(l.debit - l.credit) ELSE 0 END), 0) AS "retainedEarnings"
        FROM journal_lines l
        JOIN journals j
          ON j.id = l."journalId"
         AND j.status NOT IN ('DRAFT', 'DELETED')
        JOIN ledger_accounts a ON a.id = l."accountId"
       WHERE l."journalDate" <= ${to}
       GROUP BY l."orgId"
    `,
  ])

  const incomeByOrg = new Map(figures.map((row) => [row.orgId, row]))
  const receivableByOrg = new Map(receivables.map((row) => [row.orgId, row.outstanding]))
  const payableByOrg = new Map(payables.map((row) => [row.orgId, row.outstanding]))
  const balanceByOrg = new Map(balances.map((row) => [row.orgId, row]))

  const rows: CompanySnapshot[] = companies.map((company) => {
    const figure = incomeByOrg.get(company.id)
    const balance = balanceByOrg.get(company.id)
    const income = new Decimal(figure?.income ?? 0)
    const expenses = new Decimal(figure?.expenses ?? 0)
    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      currency: company.baseCurrency,
      parentOrgId: company.parentOrgId,
      income,
      expenses,
      netIncome: income.minus(expenses),
      receivable: new Decimal(receivableByOrg.get(company.id) ?? 0),
      payable: new Decimal(payableByOrg.get(company.id) ?? 0),
      cash: new Decimal(balance?.cash ?? 0),
      equity: new Decimal(balance?.equity ?? 0),
      openingBalance: new Decimal(balance?.openingBalance ?? 0),
      retainedEarnings: new Decimal(balance?.retainedEarnings ?? 0),
    }
  })

  const grouped = new Map<string, CurrencyTotal>()
  for (const row of rows) {
    const current = grouped.get(row.currency) ?? {
      currency: row.currency,
      income: ZERO,
      expenses: ZERO,
      netIncome: ZERO,
      receivable: ZERO,
      payable: ZERO,
      cash: ZERO,
      equity: ZERO,
      openingBalance: ZERO,
      retainedEarnings: ZERO,
      companies: 0,
    }
    current.income = current.income.plus(row.income)
    current.expenses = current.expenses.plus(row.expenses)
    current.netIncome = current.netIncome.plus(row.netIncome)
    current.receivable = current.receivable.plus(row.receivable)
    current.payable = current.payable.plus(row.payable)
    current.cash = current.cash.plus(row.cash)
    current.equity = current.equity.plus(row.equity)
    current.openingBalance = current.openingBalance.plus(row.openingBalance)
    current.retainedEarnings = current.retainedEarnings.plus(row.retainedEarnings)
    current.companies += 1
    grouped.set(row.currency, current)
  }

  return { rows, totals: [...grouped.values()] }
}
