import 'server-only'

import { parseCsv, pick, type CsvRow } from '@/lib/csv'
import {
  applyStatementPackRow,
  statementFormatPackById,
  type StatementPackId,
} from '@/lib/erp/statement-import-packs'
import { isCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, parseMoneyInput, ZERO } from '@/lib/money'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

/**
 * Reading a bank statement.
 *
 * An imported row is a **claim by the bank**, not an entry in the books. It is
 * held in its own table until someone decides what it is: matched to something
 * already posted, or set aside. Nothing here writes to the ledger, which is why
 * importing a statement can never put the accounts wrong.
 */

export type StatementPreview = {
  total: number
  ready: number
  duplicates: number
  issues: { row: number; message: string }[]
  sample: { date: string; description: string; amount: string }[]
}

/**
 * Statement exports disagree about almost everything except that there is a date,
 * a description and an amount. Two conventions cover nearly all of them: a single
 * signed `amount`, or separate money-in and money-out columns.
 */
function readRow(row: CsvRow): { date: string; description: string; amount: Decimal; reference: string; externalId: string } | null {
  const date = pick(row, 'date', 'transactionDate', 'postedDate', 'valueDate')
  if (!date) return null

  const normalised = normaliseDate(date)
  if (!normalised) return null

  const description =
    pick(row, 'description', 'details', 'narrative', 'memo', 'payee', 'particulars') || '(no description)'

  const signed = pick(row, 'amount', 'value')
  const credit = pick(row, 'creditAmount', 'moneyIn', 'deposit', 'credit', 'paidIn')
  const debit = pick(row, 'debitAmount', 'moneyOut', 'withdrawal', 'debit', 'paidOut')

  let amount: Decimal | null = null
  if (signed) {
    amount = parseMoneyInput(signed)
  } else if (credit || debit) {
    const inAmount = credit ? (parseMoneyInput(credit) ?? ZERO) : ZERO
    const outAmount = debit ? (parseMoneyInput(debit) ?? ZERO) : ZERO
    amount = inAmount.minus(outAmount.abs())
  }

  if (!amount || amount.isZero()) return null

  return {
    date: normalised,
    description,
    amount,
    reference: pick(row, 'reference', 'ref', 'chequeNumber', 'transactionId'),
    externalId: pick(row, 'externalId', 'fitid', 'transactionId', 'id'),
  }
}

/** Accept the orderings people actually export, and refuse to guess between them. */
function normaliseDate(value: string): CalendarDate | null {
  // `isCalendarDate` narrows `string` to `CalendarDate`, which is a string alias,
  // so a narrowed variable would be `never` afterwards. Re-reading the expression
  // avoids the narrowing without weakening the guard where it is actually useful.
  if (isCalendarDate(value.trim())) return value.trim()

  // DD/MM/YYYY and YYYY/MM/DD. An ambiguous DD/MM vs MM/DD is resolved in favour
  // of day-first, which is what every locale this business trades in uses.
  const slash = value.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/)
  if (!slash) return null

  const [, a, b, c] = slash
  const pad = (n: string) => n.padStart(2, '0')

  if (a.length === 4) {
    const candidate = `${a}-${pad(b)}-${pad(c)}`
    return isCalendarDate(candidate) ? candidate : null
  }
  if (c.length === 4) {
    const candidate = `${c}-${pad(b)}-${pad(a)}`
    return isCalendarDate(candidate) ? candidate : null
  }
  return null
}

export async function importStatement(
  ctx: OrgContext,
  accountId: string,
  csv: string,
  options: { dryRun?: boolean; packId?: StatementPackId | string | null } = {},
): Promise<StatementPreview & { imported: number }> {
  const account = await db.ledgerAccount.findFirst({
    where: { id: accountId, orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true, subtype: true },
  })
  if (!account) throw notFound('Account')
  if (!['BANK', 'CREDIT_CARD'].includes(account.subtype)) {
    throw validation(`"${account.name}" does not receive a bank statement.`)
  }

  const { rows } = parseCsv(csv)
  const pack = statementFormatPackById(options.packId)
  const issues: { row: number; message: string }[] = []
  const parsed: ReturnType<typeof readRow>[] = []

  rows.forEach((row, index) => {
    const read = readRow(applyStatementPackRow(row, pack))
    if (!read) {
      issues.push({
        row: index + 2,
        message: 'Could not read a date and an amount from this row',
      })
      return
    }
    parsed.push(read)
  })

  const valid = parsed.filter(Boolean) as NonNullable<ReturnType<typeof readRow>>[]

  // Two guards against importing the same statement twice: the bank's own
  // identifier where the file has one, and an exact date/amount/description match
  // where it does not.
  const existing = await db.importedTransaction.findMany({
    where: { orgId: ctx.orgId, accountId },
    select: { externalId: true, date: true, amount: true, description: true },
  })

  const seenExternal = new Set(existing.map((e) => e.externalId).filter(Boolean))
  // Both sides are normalised to the same scale before comparing. A stored
  // NUMERIC reads back as "800" where the parsed value is "800.0000", and a
  // duplicate check that compares those as strings never finds anything.
  const shapeOf = (date: string, amount: Decimal, description: string) =>
    `${date}|${amount.toFixed(4)}|${description.trim().toLowerCase()}`

  const seenShape = new Set(
    existing.map((e) =>
      shapeOf(e.date.toISOString().slice(0, 10), new Decimal(e.amount.toString()), e.description),
    ),
  )

  const fresh: typeof valid = []
  let duplicates = 0

  for (const row of valid) {
    const shape = shapeOf(row.date, row.amount, row.description)
    if ((row.externalId && seenExternal.has(row.externalId)) || seenShape.has(shape)) {
      duplicates += 1
      continue
    }
    seenShape.add(shape)
    if (row.externalId) seenExternal.add(row.externalId)
    fresh.push(row)
  }

  const preview: StatementPreview = {
    total: rows.length,
    ready: fresh.length,
    duplicates,
    issues: issues.slice(0, 50),
    sample: fresh.slice(0, 10).map((row) => ({
      date: row.date,
      description: row.description,
      amount: row.amount.toFixed(2),
    })),
  }

  if (options.dryRun) return { ...preview, imported: 0 }

  const meta = await requestMeta()

  await db.$transaction(async (tx) => {
    await tx.importedTransaction.createMany({
      data: fresh.map((row) => ({
        orgId: ctx.orgId,
        accountId,
        date: toDate(row.date),
        description: row.description,
        reference: row.reference || null,
        amount: row.amount.toFixed(4),
        externalId: row.externalId || null,
        importedById: ctx.userId,
      })),
      skipDuplicates: true,
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ImportedTransaction',
        entityId: accountId,
        action: 'CREATE',
        after: { account: account.name, imported: fresh.length, duplicates },
      },
      meta,
    )
  })

  return { ...preview, imported: fresh.length }
}

export type SuggestedMatch = {
  journalLineId: string
  journalNumber: string
  date: Date
  description: string | null
  amount: Decimal
  /** How far apart the two dates are, in days. Lower is a better match. */
  dayGap: number
}

/**
 * Suggest what an imported row might be.
 *
 * The rule is deliberately strict: **the amount must match exactly**, and the
 * dates must be within a few days. A near-match on amount is not a match — it is
 * two different transactions, and offering it as a suggestion is how a
 * reconciliation ends up hiding a real discrepancy.
 */
export async function suggestMatches(
  ctx: OrgContext,
  importedId: string,
  options: { windowDays?: number } = {},
): Promise<SuggestedMatch[]> {
  const imported = await db.importedTransaction.findFirst({
    where: { id: importedId, orgId: ctx.orgId },
    select: { id: true, accountId: true, date: true, amount: true },
  })
  if (!imported) throw notFound('Imported transaction')

  const window = options.windowDays ?? 7
  const amount = new Decimal(imported.amount.toString())

  const rows = await db.$queryRaw<
    {
      lineId: string
      journalNumber: string
      date: Date
      description: string | null
      memo: string | null
      debit: string
      credit: string
    }[]
  >`
    SELECT l.id              AS "lineId",
           j."journalNumber" AS "journalNumber",
           j.date            AS "date",
           l.description     AS "description",
           j.memo            AS "memo",
           l.debit           AS "debit",
           l.credit          AS "credit"
      FROM journal_lines l
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
     WHERE l."orgId" = ${ctx.orgId}
       AND l."accountId" = ${imported.accountId}
       AND (l.debit - l.credit) = ${amount.toFixed(4)}::numeric
       AND l."journalDate" BETWEEN ${imported.date}::date - ${window}::int
                               AND ${imported.date}::date + ${window}::int
       AND NOT EXISTS (
             SELECT 1 FROM imported_transactions m
              WHERE m."matchedJournalLineId" = l.id AND m.id <> ${importedId}
           )
     ORDER BY abs(j.date - ${imported.date}::date) ASC
     LIMIT 10
  `

  return rows.map((row) => ({
    journalLineId: row.lineId,
    journalNumber: row.journalNumber,
    date: row.date,
    description: row.description ?? row.memo,
    amount: new Decimal(row.debit).minus(row.credit),
    dayGap: Math.abs(
      Math.round((row.date.getTime() - imported.date.getTime()) / 86_400_000),
    ),
  }))
}

export async function listImported(ctx: OrgContext, accountId: string, status?: string) {
  const rows = await db.importedTransaction.findMany({
    where: {
      orgId: ctx.orgId,
      accountId,
      ...(status ? { status: status as 'PENDING' } : {}),
    },
    select: {
      id: true, date: true, description: true, reference: true, amount: true, status: true,
      matchedJournalLine: {
        select: { id: true, journal: { select: { id: true, journalNumber: true } } },
      },
    },
    orderBy: [{ date: 'asc' }],
    take: 500,
  })

  return rows.map((row) => ({ ...row, amount: row.amount.toString() }))
}

export async function match(ctx: OrgContext, importedId: string, journalLineId: string) {
  const meta = await requestMeta()

  const [imported, line] = await Promise.all([
    db.importedTransaction.findFirst({
      where: { id: importedId, orgId: ctx.orgId },
      select: { id: true, accountId: true, amount: true, description: true },
    }),
    db.journalLine.findFirst({
      where: { id: journalLineId, orgId: ctx.orgId },
      select: { id: true, accountId: true, debit: true, credit: true },
    }),
  ])

  if (!imported) throw notFound('Imported transaction')
  if (!line) throw notFound('Journal line')

  if (line.accountId !== imported.accountId) {
    throw validation('That entry is on a different account from the statement line.')
  }

  const lineAmount = new Decimal(line.debit.toString()).minus(line.credit.toString())
  if (!lineAmount.equals(imported.amount.toString())) {
    throw validation(
      `The statement says ${new Decimal(imported.amount.toString()).toFixed(2)} but that entry is ` +
        `${lineAmount.toFixed(2)}. Matching them would hide a real difference.`,
    )
  }

  return db.$transaction(async (tx) => {
    await tx.importedTransaction.update({
      where: { id: importedId },
      data: { status: 'MATCHED', matchedJournalLineId: journalLineId, matchedAt: new Date() },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ImportedTransaction',
        entityId: importedId,
        action: 'UPDATE',
        after: { status: 'MATCHED', journalLineId, description: imported.description },
      },
      meta,
    )

    return { id: importedId }
  })
}

export async function exclude(ctx: OrgContext, importedId: string) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const imported = await tx.importedTransaction.update({
      where: { id: importedId },
      data: { status: 'EXCLUDED', matchedJournalLineId: null },
      select: { id: true, description: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ImportedTransaction',
        entityId: importedId,
        action: 'UPDATE',
        after: { status: 'EXCLUDED', description: imported.description },
      },
      meta,
    )

    return { id: importedId }
  })
}

/** The columns an import understands, shown next to the upload box. */
export const STATEMENT_COLUMNS = [
  { name: 'Date', required: true, aliases: 'transaction date, posted date, value date' },
  { name: 'Description', required: true, aliases: 'details, narrative, payee, particulars' },
  { name: 'Amount', required: true, aliases: 'value — positive in, negative out' },
  { name: 'Money in / Money out', required: false, aliases: 'instead of a single signed amount' },
  { name: 'Reference', required: false, aliases: 'ref, cheque number' },
  { name: 'External ID', required: false, aliases: 'FITID — used to avoid importing twice' },
]
