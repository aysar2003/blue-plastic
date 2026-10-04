import 'server-only'
import type { AccountSubtype, AccountType } from '@prisma/client'

import type { CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { db, type Tx } from '@/server/db'
import {
  accountFigures,
  CASH_SUBTYPES,
  present,
  sumBy,
  type AccountFigures,
  type ReportRange,
} from './framework'

export type StatementRow = {
  accountId: string
  code: string
  name: string
  /** Statement class — Assets, Liabilities, Income, … */
  type: AccountType
  /** Detail kind within that class — Bank, Operating expense, … */
  subtype: AccountSubtype
  amount: Decimal
  /** Share of total income, for a profit and loss. */
  percentOfIncome?: Decimal
  comparison?: Decimal
  /** A heading such as a parent account or a further detail, so the section can fold. */
  group?: string | null
}

export type StatementSection = {
  key: string
  label: string
  rows: StatementRow[]
  total: Decimal
  comparisonTotal?: Decimal
}

/* --- Profit and loss ------------------------------------------------------ */

const INCOME_GROUPS: { key: string; label: string; subtypes: AccountSubtype[] }[] = [
  { key: 'income', label: 'Income', subtypes: ['INCOME', 'SALES_DISCOUNTS'] },
  { key: 'cogs', label: 'Cost of goods sold', subtypes: ['COST_OF_GOODS_SOLD'] },
  { key: 'expenses', label: 'Operating expenses', subtypes: ['OPERATING_EXPENSE', 'DEPRECIATION'] },
  { key: 'otherIncome', label: 'Other income', subtypes: ['OTHER_INCOME'] },
  { key: 'otherExpense', label: 'Other expenses', subtypes: ['OTHER_EXPENSE'] },
]

export type ProfitAndLoss = {
  range: ReportRange
  sections: StatementSection[]
  totalIncome: Decimal
  totalCogs: Decimal
  grossProfit: Decimal
  totalOperatingExpenses: Decimal
  operatingProfit: Decimal
  netIncome: Decimal
  comparison?: { netIncome: Decimal; totalIncome: Decimal }
}

/**
 * Profit and loss.
 *
 * Grouped so gross profit is visible on its own line. For a business that buys
 * and resells, gross profit is the number that actually says whether the trade
 * works — net profit tells you about the overheads as well, which is a different
 * question.
 */
export async function profitAndLoss(
  orgId: string,
  range: ReportRange,
  options: { client?: Tx; comparison?: ReportRange } = {},
): Promise<ProfitAndLoss> {
  // The year-end closing entry is left out: it zeroes the nominal accounts at the
  // year end, and counting it would report a closed year as having earned nothing.
  const figures = await accountFigures(orgId, range, {
    client: options.client,
    excludeClosing: true,
  })
  // The comparison inherits the basis unless it names its own, so a cash-basis
  // report cannot quietly compare itself against an accrual-basis period.
  const comparisonFigures = options.comparison
    ? await accountFigures(
        orgId,
        { ...options.comparison, basis: options.comparison.basis ?? range.basis },
        { client: options.client, excludeClosing: true },
      )
    : null

  const comparisonById = new Map(
    (comparisonFigures ?? []).map((row) => [row.accountId, present(row.type, row.movement)]),
  )

  const sections = INCOME_GROUPS.map((group) => {
    const rows: StatementRow[] = figures
      .filter((row) => group.subtypes.includes(row.subtype))
      .map((row) => ({
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        type: row.type,
        subtype: row.subtype,
        amount: present(row.type, row.movement),
        comparison: comparisonById.get(row.accountId),
      }))
      .filter((row) => !row.amount.isZero() || !(row.comparison ?? ZERO).isZero())

    return {
      key: group.key,
      label: group.label,
      rows,
      total: sumBy(rows, (row) => row.amount),
      comparisonTotal: comparisonFigures ? sumBy(rows, (row) => row.comparison ?? ZERO) : undefined,
    }
  })

  const totalOf = (key: string) => sections.find((section) => section.key === key)?.total ?? ZERO

  const totalIncome = totalOf('income')
  const totalCogs = totalOf('cogs')
  const grossProfit = totalIncome.minus(totalCogs)
  const totalOperatingExpenses = totalOf('expenses')
  const operatingProfit = grossProfit.minus(totalOperatingExpenses)
  const netIncome = operatingProfit.plus(totalOf('otherIncome')).minus(totalOf('otherExpense'))

  // Every line as a share of income, which is how a profit and loss is read once
  // the absolute numbers stop being surprising.
  const meta = await (options.client ?? db).ledgerAccount.findMany({
    where: { orgId },
    select: { id: true, name: true, detailType: true, parentId: true },
  })
  const byId = new Map(meta.map((account) => [account.id, account]))

  for (const section of sections) {
    for (const row of section.rows) {
      row.percentOfIncome = totalIncome.isZero()
        ? ZERO
        : row.amount.dividedBy(totalIncome).times(100).toDecimalPlaces(1)
      const account = byId.get(row.accountId)
      const parent = account?.parentId ? byId.get(account.parentId) : undefined
      row.group = account?.detailType || parent?.name || null
    }
  }

  return {
    range,
    sections,
    totalIncome,
    totalCogs,
    grossProfit,
    totalOperatingExpenses,
    operatingProfit,
    netIncome,
    comparison: comparisonFigures
      ? {
          netIncome: netIncomeOf(comparisonFigures),
          totalIncome: sumBy(
            comparisonFigures.filter((row) => row.type === 'REVENUE'),
            (row) => present(row.type, row.movement),
          ),
        }
      : undefined,
  }
}

function netIncomeOf(figures: AccountFigures[]): Decimal {
  return sumBy(
    figures.filter((row) => row.type === 'REVENUE' || row.type === 'EXPENSE'),
    (row) => (row.type === 'REVENUE' ? present(row.type, row.movement) : present(row.type, row.movement).negated()),
  )
}

/* --- Balance sheet -------------------------------------------------------- */

const BALANCE_GROUPS: { key: string; label: string; subtypes: AccountSubtype[] }[] = [
  {
    key: 'currentAssets',
    label: 'Current assets',
    subtypes: ['BANK', 'UNDEPOSITED_FUNDS', 'ACCOUNTS_RECEIVABLE', 'INVENTORY', 'OTHER_CURRENT_ASSET'],
  },
  {
    key: 'fixedAssets',
    label: 'Fixed assets',
    subtypes: ['FIXED_ASSET', 'ACCUMULATED_DEPRECIATION', 'OTHER_ASSET'],
  },
  {
    key: 'currentLiabilities',
    label: 'Current liabilities',
    subtypes: ['ACCOUNTS_PAYABLE', 'CREDIT_CARD', 'SALES_TAX_PAYABLE', 'OTHER_CURRENT_LIABILITY'],
  },
  { key: 'longTermLiabilities', label: 'Long-term liabilities', subtypes: ['LONG_TERM_LIABILITY'] },
  {
    key: 'equity',
    label: 'Equity',
    subtypes: ['OWNERS_EQUITY', 'RETAINED_EARNINGS', 'OPENING_BALANCE_EQUITY', 'DRAWINGS'],
  },
]

export type BalanceSheet = {
  asOf: CalendarDate
  sections: StatementSection[]
  totalAssets: Decimal
  totalLiabilities: Decimal
  /** Equity accounts as posted, before accumulated profit is added. */
  postedEquity: Decimal
  /** Profit earned and not yet closed to retained earnings. */
  accumulatedProfit: Decimal
  totalEquity: Decimal
  /** assets − liabilities − equity. Must be zero. */
  difference: Decimal
  balanced: boolean
}

/**
 * Balance sheet.
 *
 * The accumulated-profit line is the part worth understanding. Revenue and
 * expense accounts are nominal: their balances belong in equity, but they are
 * only *moved* there by the year-end closing entry (Phase 9). Until a year is
 * closed, its profit sits in the profit-and-loss accounts.
 *
 * So the equity section adds the cumulative balance of every profit-and-loss
 * account up to the reporting date. Anything already closed has been zeroed out
 * of those accounts and sits in Retained Earnings instead, so it is counted
 * exactly once either way.
 *
 * That is also why the sheet balances: over every account,
 * Σdebit = Σcredit, so assets − liabilities − equity − (revenue − expenses) = 0.
 * Including accumulated profit is not a plug; it is the missing term.
 */
export async function balanceSheet(
  orgId: string,
  asOf: CalendarDate,
  options: { client?: Tx; basis?: 'accrual' | 'cash' } = {},
): Promise<BalanceSheet> {
  const figures = await accountFigures(
    orgId,
    { from: '1900-01-01', to: asOf, basis: options.basis },
    { client: options.client },
  )

  const sections = BALANCE_GROUPS.map((group) => {
    const rows = figures
      .filter((row) => group.subtypes.includes(row.subtype))
      .map((row) => ({
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        type: row.type,
        subtype: row.subtype,
        amount: present(row.type, row.closing),
      }))
      .filter((row) => !row.amount.isZero())

    return { key: group.key, label: group.label, rows, total: sumBy(rows, (row) => row.amount) }
  })

  const totalOf = (key: string) => sections.find((section) => section.key === key)?.total ?? ZERO

  const totalAssets = totalOf('currentAssets').plus(totalOf('fixedAssets'))
  const totalLiabilities = totalOf('currentLiabilities').plus(totalOf('longTermLiabilities'))
  const postedEquity = totalOf('equity')

  const accumulatedProfit = sumBy(
    figures.filter((row) => row.type === 'REVENUE' || row.type === 'EXPENSE'),
    (row) => (row.type === 'REVENUE' ? present(row.type, row.closing) : present(row.type, row.closing).negated()),
  )

  const totalEquity = postedEquity.plus(accumulatedProfit)
  const difference = totalAssets.minus(totalLiabilities).minus(totalEquity)

  return {
    asOf,
    sections,
    totalAssets,
    totalLiabilities,
    postedEquity,
    accumulatedProfit,
    totalEquity,
    difference,
    balanced: difference.isZero(),
  }
}

/* --- Cash flow ------------------------------------------------------------ */

type CashFlowSection = 'operating' | 'investing' | 'financing'

const SECTION_FOR: Record<AccountSubtype, CashFlowSection> = {
  // Operating: the working capital the trade runs on.
  ACCOUNTS_RECEIVABLE: 'operating',
  INVENTORY: 'operating',
  OTHER_CURRENT_ASSET: 'operating',
  ACCOUNTS_PAYABLE: 'operating',
  CREDIT_CARD: 'operating',
  SALES_TAX_PAYABLE: 'operating',
  OTHER_CURRENT_LIABILITY: 'operating',
  INCOME: 'operating',
  OTHER_INCOME: 'operating',
  SALES_DISCOUNTS: 'operating',
  COST_OF_GOODS_SOLD: 'operating',
  OPERATING_EXPENSE: 'operating',
  OTHER_EXPENSE: 'operating',
  DEPRECIATION: 'operating',

  // Investing: what the business owns for the long term.
  FIXED_ASSET: 'investing',
  OTHER_ASSET: 'investing',

  // Accumulated depreciation is operating, not investing, even though it sits
  // against a fixed asset. Net income has already been reduced by the
  // depreciation charge, which moved no cash, so the credit belongs where it
  // cancels that: as the add-back. Putting it in investing would net it against
  // capital expenditure and understate what was actually spent on assets.
  ACCUMULATED_DEPRECIATION: 'operating',

  // Financing: who funded it.
  LONG_TERM_LIABILITY: 'financing',
  OWNERS_EQUITY: 'financing',
  RETAINED_EARNINGS: 'financing',
  OPENING_BALANCE_EQUITY: 'financing',
  DRAWINGS: 'financing',

  // Cash itself. Never classified — it is the answer, not an input.
  BANK: 'operating',
  UNDEPOSITED_FUNDS: 'operating',
}

export type CashFlowLine = { accountId: string; label: string; amount: Decimal }

export type CashFlow = {
  range: ReportRange
  netIncome: Decimal
  operating: { lines: CashFlowLine[]; total: Decimal }
  investing: { lines: CashFlowLine[]; total: Decimal }
  financing: { lines: CashFlowLine[]; total: Decimal }
  netChange: Decimal
  openingCash: Decimal
  closingCash: Decimal
  /** The statement's own check: does it explain the actual movement in cash? */
  reconciles: boolean
  difference: Decimal
}

/**
 * Statement of cash flows, indirect method.
 *
 * Built on an identity rather than a classification, which is what makes it
 * always reconcile. Over every account in the ledger, Σ(debit − credit) = 0 for
 * any period. So for the cash accounts:
 *
 *     Δcash = − Σ(debit − credit) over every non-cash account
 *
 * Each non-cash account therefore contributes exactly `−movement` to the change
 * in cash. Classifying those contributions into operating, investing and
 * financing rearranges the statement; it cannot change the total. A cash flow
 * that does not tie to the bank is the commonest fault in a set of accounts, and
 * this one cannot have it.
 *
 * Revenue and expense contributions sum to net income, so they are shown that way
 * and the working-capital accounts follow as adjustments — which is precisely the
 * indirect method.
 */
export async function cashFlow(
  orgId: string,
  range: ReportRange,
  options: { client?: Tx } = {},
): Promise<CashFlow> {
  const figures = await accountFigures(orgId, range, {
    client: options.client,
    excludeClosing: true,
  })

  const isCash = (row: AccountFigures) => CASH_SUBTYPES.includes(row.subtype)
  const cashAccounts = figures.filter(isCash)
  const nonCash = figures.filter((row) => !isCash(row))

  const openingCash = sumBy(cashAccounts, (row) => row.opening)
  const closingCash = sumBy(cashAccounts, (row) => row.closing)
  const actualChange = closingCash.minus(openingCash)

  const netIncome = sumBy(
    nonCash.filter((row) => row.type === 'REVENUE' || row.type === 'EXPENSE'),
    (row) => row.movement.negated(),
  )

  const buckets: Record<CashFlowSection, CashFlowLine[]> = {
    operating: [],
    investing: [],
    financing: [],
  }

  for (const row of nonCash) {
    if (row.type === 'REVENUE' || row.type === 'EXPENSE') continue
    const contribution = row.movement.negated()
    if (contribution.isZero()) continue
    buckets[SECTION_FOR[row.subtype]].push({
      accountId: row.accountId,
      label: `${row.code} ${row.name}`,
      amount: contribution,
    })
  }

  const operatingTotal = netIncome.plus(sumBy(buckets.operating, (line) => line.amount))
  const investingTotal = sumBy(buckets.investing, (line) => line.amount)
  const financingTotal = sumBy(buckets.financing, (line) => line.amount)
  const netChange = operatingTotal.plus(investingTotal).plus(financingTotal)

  return {
    range,
    netIncome,
    operating: { lines: buckets.operating, total: operatingTotal },
    investing: { lines: buckets.investing, total: investingTotal },
    financing: { lines: buckets.financing, total: financingTotal },
    netChange,
    openingCash,
    closingCash,
    difference: netChange.minus(actualChange),
    reconciles: netChange.equals(actualChange),
  }
}
