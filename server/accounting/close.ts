import 'server-only'

import { toCalendarDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import type { Tx } from '@/server/db'
import { precondition } from '@/server/errors'
import { postJournal, reverseJournal, type PostedJournal } from './posting'

/**
 * The year-end close.
 *
 * Revenue and expense accounts are *nominal*: they measure a year, not a state,
 * and a new year has to start them at zero. The closing entry is what does it —
 * it debits every credit-balance nominal account, credits every debit-balance
 * one, and puts the difference to Retained Earnings.
 *
 * It is an ordinary journal. It balances, it is immutable, it appears in the
 * ledger, and it can be reversed — because a year that was closed too early is a
 * common event and the fix must not be a hand edit.
 */

export type ClosingLine = {
  accountId: string
  code: string
  name: string
  /** Debit − credit balance to the year end. */
  balance: Decimal
}

export type ClosingPreview = {
  fiscalYearId: string
  year: number
  endDate: CalendarDate
  lines: ClosingLine[]
  /** Credited to Retained Earnings when positive; debited when negative. */
  netIncome: Decimal
  retainedEarningsAccountId: string
  retainedEarningsName: string
}

/**
 * What the closing entry would be.
 *
 * Balances are cumulative to the year end, not movement within the year. If an
 * earlier year was never closed, its profit is still sitting in the nominal
 * accounts and belongs in Retained Earnings too — and taking the balance rather
 * than the movement sweeps it without a special case. Earlier years' profit and
 * loss statements are unaffected, because this journal is dated at *this* year
 * end and their figures are movements within their own dates.
 */
export async function closingPreview(
  tx: Tx,
  ctx: OrgContext,
  fiscalYearId: string,
): Promise<ClosingPreview> {
  const fiscalYear = await tx.fiscalYear.findFirst({
    where: { id: fiscalYearId, orgId: ctx.orgId },
    select: { id: true, year: true, endDate: true, status: true, closingJournalId: true },
  })
  if (!fiscalYear) throw precondition('That fiscal year does not exist.')

  if (fiscalYear.closingJournalId) {
    throw precondition(`Fiscal year ${fiscalYear.year} has already been closed.`)
  }

  const retainedEarnings = await tx.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, systemKey: 'RETAINED_EARNINGS' },
    select: { id: true, name: true, isActive: true },
  })
  if (!retainedEarnings) {
    throw precondition(
      'There is no Retained Earnings account. It is created with the chart of accounts and cannot be deleted.',
    )
  }

  const rows = await tx.$queryRaw<{ accountId: string; code: string; name: string; balance: string }[]>`
    SELECT a.id   AS "accountId",
           a.code AS code,
           a.name AS name,
           COALESCE(SUM(l.debit - l.credit), 0) AS balance
      FROM ledger_accounts a
      JOIN journal_lines l ON l."accountId" = a.id AND l."journalDate" <= ${fiscalYear.endDate}
      JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
     WHERE a."orgId" = ${ctx.orgId}
       AND a.type IN ('REVENUE', 'COGS', 'EXPENSE')
     GROUP BY a.id, a.code, a.name
    HAVING COALESCE(SUM(l.debit - l.credit), 0) <> 0
     ORDER BY a.code
  `

  const lines = rows.map((row) => ({
    accountId: row.accountId,
    code: row.code,
    name: row.name,
    balance: new Decimal(row.balance),
  }))

  // Expenses are debits and revenue credits, so the net of the balances is the
  // loss. Negating it gives profit, which is what goes to Retained Earnings.
  const netIncome = lines.reduce((sum, line) => sum.minus(line.balance), ZERO)

  return {
    fiscalYearId: fiscalYear.id,
    year: fiscalYear.year,
    endDate: toCalendarDate(fiscalYear.endDate),
    lines,
    netIncome,
    retainedEarningsAccountId: retainedEarnings.id,
    retainedEarningsName: retainedEarnings.name,
  }
}

export type YearClosed = {
  journal: PostedJournal | null
  preview: ClosingPreview
  periodsLocked: number
}

/**
 * Close a fiscal year: post the closing entry, then lock the year and every
 * period in it.
 *
 * The order matters. The closing entry is posted while the periods are still
 * open, because the same guard that stops a user back-dating into a closed month
 * would otherwise stop the close itself.
 */
export async function closeYear(
  tx: Tx,
  ctx: OrgContext,
  fiscalYearId: string,
): Promise<YearClosed> {
  const preview = await closingPreview(tx, ctx, fiscalYearId)

  // Note what is *not* required here: that the months are closed first. They
  // cannot be. The closing entry is dated at the year end, which falls inside the
  // last period, and a closed period refuses postings — including this one. The
  // year-end closes the months itself, in the same transaction, immediately after
  // the entry it had to post while they were open.
  const laterOpenYear = await tx.fiscalYear.findFirst({
    where: { orgId: ctx.orgId, year: { lt: preview.year }, closingJournalId: null },
    orderBy: { year: 'asc' },
    select: { year: true },
  })
  if (laterOpenYear) {
    throw precondition(
      `Close fiscal year ${laterOpenYear.year} first. Years close in order, or the earlier year's ` +
        `profit would be swept into the wrong one.`,
    )
  }

  let journal: PostedJournal | null = null

  if (preview.lines.length > 0) {
    journal = await postJournal(tx, ctx, {
      date: preview.endDate,
      memo: `Closing entry for fiscal year ${preview.year}`,
      sourceType: 'CLOSING_ENTRY',
      sourceId: fiscalYearId,
      isClosingEntry: true,
      lines: [
        // Each nominal account is taken to zero: whatever its balance is, on the
        // opposite side.
        ...preview.lines.map((line) =>
          line.balance.isNegative()
            ? { accountId: line.accountId, debit: line.balance.negated().toString() }
            : { accountId: line.accountId, credit: line.balance.toString() },
        ),
        preview.netIncome.isNegative()
          ? {
              accountId: preview.retainedEarningsAccountId,
              debit: preview.netIncome.negated().toString(),
              description: `Loss for fiscal year ${preview.year}`,
            }
          : {
              accountId: preview.retainedEarningsAccountId,
              credit: preview.netIncome.toString(),
              description: `Profit for fiscal year ${preview.year}`,
            },
      ],
    })
  }

  const locked = await tx.accountingPeriod.updateMany({
    where: { orgId: ctx.orgId, fiscalYearId, status: { not: 'LOCKED' } },
    data: { status: 'LOCKED', closedAt: new Date(), closedById: ctx.userId },
  })

  await tx.fiscalYear.update({
    where: { id: fiscalYearId },
    data: { status: 'LOCKED', closedAt: new Date(), closingJournalId: journal?.id ?? null },
  })

  return { journal, preview, periodsLocked: locked.count }
}

/**
 * Reopen a closed year.
 *
 * The closing entry is reversed, never deleted — R4 forbids touching a posted
 * journal, and an audit trail that can lose a year-end is not an audit trail.
 * The periods are unlocked first so the reversal has an open period to land in,
 * and the reversal takes the same date as the entry it undoes, so no other
 * period's figures move.
 */
export async function reopenYear(
  tx: Tx,
  ctx: OrgContext,
  fiscalYearId: string,
  reason: string,
): Promise<{ reversal: PostedJournal | null }> {
  const fiscalYear = await tx.fiscalYear.findFirst({
    where: { id: fiscalYearId, orgId: ctx.orgId },
    select: { id: true, year: true, status: true, closingJournalId: true },
  })
  if (!fiscalYear) throw precondition('That fiscal year does not exist.')

  if (fiscalYear.status !== 'LOCKED') {
    throw precondition(`Fiscal year ${fiscalYear.year} is not closed.`)
  }

  const laterClosed = await tx.fiscalYear.findFirst({
    where: { orgId: ctx.orgId, year: { gt: fiscalYear.year }, status: 'LOCKED' },
    orderBy: { year: 'asc' },
    select: { year: true },
  })
  if (laterClosed) {
    throw precondition(
      `Reopen fiscal year ${laterClosed.year} first. Years reopen in reverse, or its opening ` +
        `retained earnings would no longer be the earlier year's closing figure.`,
    )
  }

  // Unlock before reversing: the reversal is a posting like any other and the
  // period guard applies to it too.
  await tx.accountingPeriod.updateMany({
    where: { orgId: ctx.orgId, fiscalYearId, status: 'LOCKED' },
    data: { status: 'OPEN', closedAt: null, closedById: null },
  })

  await tx.fiscalYear.update({
    where: { id: fiscalYearId },
    data: { status: 'OPEN', closedAt: null, closingJournalId: null },
  })

  const reversal = fiscalYear.closingJournalId
    ? await reverseJournal(tx, ctx, fiscalYear.closingJournalId, { reason })
    : null

  return { reversal }
}
