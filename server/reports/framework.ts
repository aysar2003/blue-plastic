import 'server-only'
import type { AccountSubtype, AccountType } from '@prisma/client'

import { isDebitNormalType, isProfitAndLossType } from '@/lib/accounting-labels'
import { toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { db, type Tx } from '@/server/db'

/**
 * The one query every financial statement is built from.
 *
 * For each account it returns the movement in a date range and the balance up to
 * the end of it, both in raw debit-minus-credit terms. Everything else — profit
 * and loss, balance sheet, cash flow — is a way of grouping and signing these
 * numbers.
 *
 * Keeping it to a single shape matters: three statements assembled by three
 * different queries will eventually disagree, and the one that disagrees is
 * always the one nobody checked.
 */
export type AccountFigures = {
  accountId: string
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  parentId: string | null
  /** Σdebit − Σcredit within the range. */
  movement: Decimal
  /** Σdebit − Σcredit from the beginning of the ledger to `to`. */
  closing: Decimal
  /** Σdebit − Σcredit from the beginning of the ledger to the day before `from`. */
  opening: Decimal
}

export type ReportBasis = 'accrual' | 'cash'

export type ReportRange = {
  from: CalendarDate
  to: CalendarDate
  basis?: ReportBasis
}

/**
 * `basis` decides *which journals count*, not how they are grouped.
 *
 * Accrual counts everything posted. Cash counts only what has moved through a
 * bank, cash or undeposited-funds account — an invoice raised and not paid is
 * income on the accrual basis and nothing at all on the cash basis.
 *
 * This is a real cash basis, not a filter on document type: it asks whether the
 * journal touched money, which is the question the cash basis actually asks.
 *
 * `excludeClosing` leaves out the year-end closing entry.
 *
 * A closing entry takes every income and expense account to zero at the year end.
 * It is a bookkeeping mechanism, not trading, and a profit and loss that counted
 * it would report the closed year as having earned nothing — which would make
 * every comparative against a closed year useless. So the profit and loss and the
 * cash flow leave it out; the balance sheet, trial balance and general ledger keep
 * it, because there the transfer to Retained Earnings is a real movement.
 *
 * Leaving it out is safe for the cash flow's identity: a closing entry balances
 * and touches no cash account, so removing it from every account at once changes
 * neither Σ(debit − credit) = 0 nor the movement in cash.
 */
export async function accountFigures(
  orgId: string,
  range: ReportRange,
  options: { client?: Tx; excludeClosing?: boolean } = {},
): Promise<AccountFigures[]> {
  const client = options.client ?? db
  const from = toDate(range.from)
  const to = toDate(range.to)
  const excludeClosing = options.excludeClosing ?? false

  const rows =
    range.basis === 'cash'
      ? await client.$queryRaw<RawFigures[]>`
          SELECT a.id AS "accountId", a.code, a.name, a.type::text AS "type",
                 a.subtype::text AS "subtype", a."parentId",
                 COALESCE(SUM(CASE WHEN l."journalDate" BETWEEN ${from} AND ${to}
                                   THEN l.debit - l.credit ELSE 0 END), 0) AS movement,
                 COALESCE(SUM(CASE WHEN l."journalDate" <= ${to}
                                   THEN l.debit - l.credit ELSE 0 END), 0) AS closing,
                 COALESCE(SUM(CASE WHEN l."journalDate" < ${from}
                                   THEN l.debit - l.credit ELSE 0 END), 0) AS opening
            FROM ledger_accounts a
            LEFT JOIN journal_lines l
              ON l."accountId" = a.id AND l."orgId" = a."orgId"
            LEFT JOIN journals j
              ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
             AND (${excludeClosing} = false OR j."isClosingEntry" = false)
             AND EXISTS (
                   SELECT 1 FROM journal_lines cl
                     JOIN ledger_accounts ca ON ca.id = cl."accountId"
                    WHERE cl."journalId" = j.id
                      AND ca.subtype IN ('BANK', 'UNDEPOSITED_FUNDS', 'CREDIT_CARD')
                 )
           WHERE a."orgId" = ${orgId}
             AND (l.id IS NULL OR j.id IS NOT NULL)
           GROUP BY a.id, a.code, a.name, a.type, a.subtype, a."parentId"
           ORDER BY a.code
        `
      : await client.$queryRaw<RawFigures[]>`
          SELECT a.id AS "accountId", a.code, a.name, a.type::text AS "type",
                 a.subtype::text AS "subtype", a."parentId",
                 COALESCE(SUM(CASE WHEN l."journalDate" BETWEEN ${from} AND ${to}
                                   THEN l.debit - l.credit ELSE 0 END), 0) AS movement,
                 COALESCE(SUM(CASE WHEN l."journalDate" <= ${to}
                                   THEN l.debit - l.credit ELSE 0 END), 0) AS closing,
                 COALESCE(SUM(CASE WHEN l."journalDate" < ${from}
                                   THEN l.debit - l.credit ELSE 0 END), 0) AS opening
            FROM ledger_accounts a
            LEFT JOIN journal_lines l
              ON l."accountId" = a.id AND l."orgId" = a."orgId"
            LEFT JOIN journals j
              ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
             AND (${excludeClosing} = false OR j."isClosingEntry" = false)
           WHERE a."orgId" = ${orgId}
             AND (l.id IS NULL OR j.id IS NOT NULL)
           GROUP BY a.id, a.code, a.name, a.type, a.subtype, a."parentId"
           ORDER BY a.code
        `

  return rows.map((row) => ({
    accountId: row.accountId,
    code: row.code,
    name: row.name,
    type: row.type as AccountType,
    subtype: row.subtype as AccountSubtype,
    parentId: row.parentId,
    movement: new Decimal(row.movement),
    closing: new Decimal(row.closing),
    opening: new Decimal(row.opening),
  }))
}

type RawFigures = {
  accountId: string
  code: string
  name: string
  type: string
  subtype: string
  parentId: string | null
  movement: string
  closing: string
  opening: string
}

/**
 * A figure shown the way an accountant reads it.
 *
 * Debit-normal accounts keep their sign; credit-normal accounts are flipped, so
 * revenue of 10,000 reads as 10,000 rather than as −10,000.
 */
export function present(type: AccountType, raw: Decimal): Decimal {
  return isDebitNormalType(type) ? raw : raw.negated()
}

export const isProfitAndLoss = isProfitAndLossType
export const isBalanceSheet = (type: AccountType) => !isProfitAndLoss(type)

/** Money accounts, for the cash-flow statement and the dashboard. */
export const CASH_SUBTYPES: AccountSubtype[] = ['BANK', 'UNDEPOSITED_FUNDS']

export type ReportGroup<T> = {
  key: string
  label: string
  rows: T[]
  total: Decimal
}

export function sumBy<T>(rows: T[], pick: (row: T) => Decimal): Decimal {
  return rows.reduce((total, row) => total.plus(pick(row)), ZERO)
}
