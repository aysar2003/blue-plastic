import 'server-only'
import type { AccountSubtype, AccountType } from '@prisma/client'

import { Decimal, ZERO } from '@/lib/money'
import { toDate, type CalendarDate } from '@/lib/date'
import { db, type Tx } from '@/server/db'

/**
 * Every balance in the system is derived here, by aggregating posted journal
 * lines. There is no stored balance to drift, and no rebuild job to run.
 *
 * **Which journals count.** Everything except `DRAFT` and `DELETED` — see the
 * `j.status NOT IN ('DRAFT', 'DELETED')` join condition in each query below.
 *
 * A `REVERSED` journal is still historical fact: its reversal sits alongside it
 * and the pair nets to nothing. Excluding reversed journals while keeping their
 * reversals would leave every corrected entry counted once, backwards.
 *
 * A `DELETED` one is different. The transaction that produced it was deleted, so
 * it is not history the business is claiming — it is an entry somebody withdrew.
 * The row is kept so that what was once posted can still be seen, and it is
 * excluded here so that it cannot reach a balance, a statement or a report. That
 * exclusion lives in this join and in the equivalent filter on every other query
 * that reads the ledger; there is no second definition of "counts".
 *
 * Each function takes an optional `client`. It defaults to the shared Prisma
 * client, and tests pass a transaction so a report can be exercised against real
 * data that is rolled back afterwards. Hand-written SQL is the one part of the
 * ledger TypeScript cannot vouch for, so it has to be run to be trusted.
 */

/** Accounts whose balance is naturally a debit. The rest are naturally credits. */
export const DEBIT_NORMAL: AccountType[] = ['ASSET', 'EXPENSE']

export const isDebitNormal = (type: AccountType): boolean => DEBIT_NORMAL.includes(type)

/**
 * Present a raw debit/credit pair the way an accountant reads it: positive when
 * the account sits on its natural side. A revenue account with 10,000 credited
 * reads as 10,000, not as -10,000.
 */
export function naturalBalance(type: AccountType, debit: Decimal.Value, credit: Decimal.Value): Decimal {
  const d = new Decimal(debit)
  const c = new Decimal(credit)
  return isDebitNormal(type) ? d.minus(c) : c.minus(d)
}

export type TrialBalanceRow = {
  accountId: string
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  parentId: string | null
  isActive: boolean
  openingDebit: Decimal
  openingCredit: Decimal
  periodDebit: Decimal
  periodCredit: Decimal
  closingDebit: Decimal
  closingCredit: Decimal
}

type RawTrialBalanceRow = {
  accountId: string
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  parentId: string | null
  isActive: boolean
  opening_debit: string
  opening_credit: string
  period_debit: string
  period_credit: string
}

/**
 * Opening balance, movement in the range, and closing balance for every account —
 * in one pass over the ledger rather than three.
 *
 * Opening and closing are each presented as a single-sided figure, because that
 * is what a trial balance is: the net of the account expressed on whichever side
 * it falls, so the two columns total to the same number.
 */
export async function trialBalance(
  orgId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { includeZero?: boolean; client?: Tx } = {},
): Promise<{ rows: TrialBalanceRow[]; totalDebit: Decimal; totalCredit: Decimal; balanced: boolean }> {
  const client = options.client ?? db
  const from = toDate(range.from)
  const to = toDate(range.to)

  const raw = await client.$queryRaw<RawTrialBalanceRow[]>`
    SELECT a.id                AS "accountId",
           a.code              AS "code",
           a.name              AS "name",
           a.type              AS "type",
           a.subtype           AS "subtype",
           a."parentId"        AS "parentId",
           a."isActive"        AS "isActive",
           COALESCE(SUM(l.debit)  FILTER (WHERE l."journalDate" <  ${from}), 0) AS opening_debit,
           COALESCE(SUM(l.credit) FILTER (WHERE l."journalDate" <  ${from}), 0) AS opening_credit,
           COALESCE(SUM(l.debit)  FILTER (WHERE l."journalDate" >= ${from}), 0) AS period_debit,
           COALESCE(SUM(l.credit) FILTER (WHERE l."journalDate" >= ${from}), 0) AS period_credit
      FROM ledger_accounts a
      LEFT JOIN journal_lines l
        ON  l."accountId"   = a.id
        AND l."orgId"       = a."orgId"
        AND l."journalDate" <= ${to}
      LEFT JOIN journals j
        ON  j.id = l."journalId"
       AND j.status NOT IN ('DRAFT', 'DELETED')
     WHERE a."orgId" = ${orgId}
       AND (l.id IS NULL OR j.id IS NOT NULL)
     GROUP BY a.id, a.code, a.name, a.type, a.subtype, a."parentId", a."isActive"
     ORDER BY a.code
  `

  let totalDebit = ZERO
  let totalCredit = ZERO

  const rows = raw
    .map((row): TrialBalanceRow => {
      const openingDebit = new Decimal(row.opening_debit)
      const openingCredit = new Decimal(row.opening_credit)
      const periodDebit = new Decimal(row.period_debit)
      const periodCredit = new Decimal(row.period_credit)

      // Net the account, then show it on whichever side it lands.
      const net = openingDebit.plus(periodDebit).minus(openingCredit).minus(periodCredit)
      const openingNet = openingDebit.minus(openingCredit)

      return {
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        type: row.type,
        subtype: row.subtype,
        parentId: row.parentId,
        isActive: row.isActive,
        openingDebit: openingNet.isPositive() ? openingNet : ZERO,
        openingCredit: openingNet.isNegative() ? openingNet.abs() : ZERO,
        periodDebit,
        periodCredit,
        closingDebit: net.isPositive() ? net : ZERO,
        closingCredit: net.isNegative() ? net.abs() : ZERO,
      }
    })
    .filter((row) => {
      const moved =
        !row.closingDebit.isZero() ||
        !row.closingCredit.isZero() ||
        !row.periodDebit.isZero() ||
        !row.periodCredit.isZero()
      return options.includeZero ? true : moved
    })

  for (const row of rows) {
    totalDebit = totalDebit.plus(row.closingDebit)
    totalCredit = totalCredit.plus(row.closingCredit)
  }

  return { rows, totalDebit, totalCredit, balanced: totalDebit.equals(totalCredit) }
}

/** Closing balance per account as at a date, keyed by account id. */
export async function balancesAsOf(
  orgId: string,
  asOf: CalendarDate,
  options: { client?: Tx } = {},
): Promise<Map<string, { debit: Decimal; credit: Decimal; natural: Decimal; type: AccountType }>> {
  const client = options.client ?? db
  const raw = await client.$queryRaw<
    { accountId: string; type: AccountType; debit: string; credit: string }[]
  >`
    SELECT a.id   AS "accountId",
           a.type AS "type",
           COALESCE(SUM(l.debit), 0)  AS debit,
           COALESCE(SUM(l.credit), 0) AS credit
      FROM ledger_accounts a
      LEFT JOIN journal_lines l
        ON  l."accountId"   = a.id
        AND l."orgId"       = a."orgId"
        AND l."journalDate" <= ${toDate(asOf)}
      LEFT JOIN journals j
        ON  j.id = l."journalId"
       AND j.status NOT IN ('DRAFT', 'DELETED')
     WHERE a."orgId" = ${orgId}
       AND (l.id IS NULL OR j.id IS NOT NULL)
     GROUP BY a.id, a.type
  `

  return new Map(
    raw.map((row) => [
      row.accountId,
      {
        debit: new Decimal(row.debit),
        credit: new Decimal(row.credit),
        natural: naturalBalance(row.type, row.debit, row.credit),
        type: row.type,
      },
    ]),
  )
}

export type LedgerEntry = {
  lineId: string
  journalId: string
  journalNumber: string
  date: Date
  memo: string | null
  description: string | null
  sourceType: string
  /** The document that produced the journal, so the register can link to it. */
  sourceId: string | null
  status: string
  debit: Decimal
  credit: Decimal
  /** Running balance on the account's natural side, from its opening position. */
  balance: Decimal
  /** The other accounts in the same journal — what a register shows in its "account" column. */
  contraAccounts: string
  /** Those same accounts, one by one, with the amount posted to each. */
  splits: { code: string; name: string; amount: string }[]
  /** The customer or vendor the line was posted against, on a control account. */
  customerId: string | null
  vendorId: string | null
  partyName: string | null
}

function readSplits(value: unknown): { code: string; name: string; amount: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { code?: unknown; name?: unknown; amount?: unknown }
    if (typeof row.code !== 'string' || typeof row.name !== 'string') return []
    return [{ code: row.code, name: row.name, amount: String(row.amount ?? '0') }]
  })
}

/**
 * The general ledger for one account: every posted line, in date order, with a
 * running balance. This is the drill-down behind every figure on every report.
 */
export async function generalLedger(
  orgId: string,
  accountId: string,
  range: { from: CalendarDate; to: CalendarDate },
  options: { limit?: number; client?: Tx } = {},
): Promise<{ opening: Decimal; entries: LedgerEntry[]; closing: Decimal; type: AccountType }> {
  const client = options.client ?? db
  const account = await client.ledgerAccount.findFirst({
    where: { id: accountId, orgId },
    select: { type: true },
  })
  if (!account) {
    return { opening: ZERO, entries: [], closing: ZERO, type: 'ASSET' }
  }

  const [openingRow] = await client.$queryRaw<{ debit: string; credit: string }[]>`
    SELECT COALESCE(SUM(l.debit), 0) AS debit, COALESCE(SUM(l.credit), 0) AS credit
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
     WHERE l."orgId" = ${orgId}
       AND l."accountId" = ${accountId}
       AND l."journalDate" < ${toDate(range.from)}
  `

  const opening = naturalBalance(account.type, openingRow?.debit ?? 0, openingRow?.credit ?? 0)

  const rows = await client.$queryRaw<
    {
      lineId: string
      journalId: string
      journalNumber: string
      date: Date
      memo: string | null
      description: string | null
      sourceType: string
      sourceId: string | null
      status: string
      debit: string
      credit: string
      contraAccounts: string | null
      splits: unknown
      customerId: string | null
      vendorId: string | null
      partyName: string | null
    }[]
  >`
    SELECT l.id              AS "lineId",
           j.id              AS "journalId",
           j."journalNumber" AS "journalNumber",
           j.date            AS "date",
           j.memo            AS "memo",
           l.description     AS "description",
           j."sourceType"::text AS "sourceType",
           j."sourceId"      AS "sourceId",
           j.status::text    AS "status",
           l.debit           AS "debit",
           l.credit          AS "credit",
           l."customerId"    AS "customerId",
           l."vendorId"      AS "vendorId",
           COALESCE(cu."displayName", ve."displayName") AS "partyName",
           (
             SELECT string_agg(DISTINCT ca.name, ', ' ORDER BY ca.name)
               FROM journal_lines cl
               JOIN ledger_accounts ca ON ca.id = cl."accountId"
              WHERE cl."journalId" = l."journalId"
                AND cl."accountId" <> l."accountId"
           ) AS "contraAccounts",
           COALESCE((
             SELECT json_agg(
                      json_build_object('code', s.code, 'name', s.name, 'amount', s.amount)
                      ORDER BY s.code
                    )
               FROM (
                 SELECT ca.code AS code,
                        ca.name AS name,
                        SUM(cl.debit - cl.credit) AS amount
                   FROM journal_lines cl
                   JOIN ledger_accounts ca ON ca.id = cl."accountId"
                  WHERE cl."journalId" = l."journalId"
                    AND cl."accountId" <> l."accountId"
                  GROUP BY ca.code, ca.name
               ) s
           ), '[]'::json) AS splits
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
      LEFT JOIN customers cu ON cu.id = l."customerId"
      LEFT JOIN vendors   ve ON ve.id = l."vendorId"
     WHERE l."orgId" = ${orgId}
       AND l."accountId" = ${accountId}
       AND l."journalDate" >= ${toDate(range.from)}
       AND l."journalDate" <= ${toDate(range.to)}
     ORDER BY j.date ASC, j."journalNumber" ASC, l."lineNumber" ASC
     LIMIT ${options.limit ?? 500}
  `

  let running = opening
  const entries = rows.map((row): LedgerEntry => {
    const debit = new Decimal(row.debit)
    const credit = new Decimal(row.credit)
    running = running.plus(naturalBalance(account.type, debit, credit))
    return {
      lineId: row.lineId,
      journalId: row.journalId,
      journalNumber: row.journalNumber,
      date: row.date,
      memo: row.memo,
      description: row.description,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      status: row.status,
      debit,
      credit,
      balance: running,
      contraAccounts: row.contraAccounts ?? '—',
      splits: readSplits(row.splits),
      customerId: row.customerId,
      vendorId: row.vendorId,
      partyName: row.partyName,
    }
  })

  return { opening, entries, closing: running, type: account.type }
}
