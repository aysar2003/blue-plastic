import 'server-only'
import type { JournalSourceType } from '@prisma/client'

import { Decimal, roundToCurrency, toMoneyString, ZERO } from '@/lib/money'
import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import type { Tx } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, nextDocumentNumber, numberTaken } from '@/server/sequences'
import { resolvePeriod } from './period'

export type DraftLine = {
  accountId: string
  debit?: Decimal.Value | null
  credit?: Decimal.Value | null
  description?: string | null
  customerId?: string | null
  vendorId?: string | null
}

export type DraftJournal = {
  date: CalendarDate
  memo?: string | null
  sourceType: JournalSourceType
  sourceId?: string | null
  isAdjusting?: boolean
  isClosingEntry?: boolean
  idempotencyKey?: string | null
  /**
   * Set when this journal reverses another. Supplied at creation rather than
   * patched in afterwards, because the moment a journal is written it is
   * immutable — including to the code that wrote it.
   */
  reversalOfId?: string | null
  reversalReason?: string | null
  /** Set only when someone typed the entry number. Other postings take the next one. */
  journalNumber?: string | null
  lines: DraftLine[]
}

export type PostedJournal = {
  id: string
  journalNumber: string
  date: Date
  periodId: string
  total: string
}

/**
 * The only function in the codebase that inserts into `journals` or
 * `journal_lines`. Everything that records a business transaction — invoices,
 * bills, payments, adjustments — builds a `DraftJournal` and hands it here.
 *
 * It takes the caller's transaction rather than opening its own, precisely so
 * that "create the invoice and post its journal" is one atomic unit. A document
 * without its journal, or a journal without its document, must be unreachable.
 */
export async function postJournal(
  tx: Tx,
  ctx: OrgContext,
  draft: DraftJournal,
): Promise<PostedJournal> {
  const currency = ctx.organization.baseCurrency

  // 1. Idempotency. A retried request must not post twice.
  if (draft.idempotencyKey) {
    const existing = await tx.journal.findUnique({
      where: { orgId_idempotencyKey: { orgId: ctx.orgId, idempotencyKey: draft.idempotencyKey } },
      select: { id: true, journalNumber: true, date: true, periodId: true },
    })
    if (existing) {
      const total = await journalTotal(tx, existing.id)
      return { ...existing, total }
    }
  }

  // 2. Round every amount before anything else looks at it, and drop the lines
  //    that round to nothing. A line that rounds to zero is not an error — a 0.4c
  //    tax line on a rounding-heavy invoice is real — it simply has no effect.
  const rounded = draft.lines
    .map((line, index) => ({
      source: line,
      index,
      debit: roundToCurrency(line.debit ?? 0, currency),
      credit: roundToCurrency(line.credit ?? 0, currency),
    }))
    .filter((line) => !line.debit.isZero() || !line.credit.isZero())

  // 3. Shape.
  for (const line of rounded) {
    if (line.debit.isNegative() || line.credit.isNegative()) {
      throw validation(
        'A journal line amount cannot be negative. Put the amount on the other side instead.',
      )
    }
    if (!line.debit.isZero() && !line.credit.isZero()) {
      throw validation('A journal line is either a debit or a credit, not both.')
    }
  }

  if (rounded.length < 2) {
    throw validation('A journal needs at least two lines: something debited and something credited.')
  }

  // 4. Balance, to the cent.
  const debits = rounded.reduce((total, line) => total.plus(line.debit), ZERO)
  const credits = rounded.reduce((total, line) => total.plus(line.credit), ZERO)

  if (!debits.equals(credits)) {
    const difference = debits.minus(credits)
    throw validation(
      `This journal is out of balance by ${toMoneyString(difference.abs(), 2)}. ` +
        `Debits total ${toMoneyString(debits, 2)}, credits total ${toMoneyString(credits, 2)}.`,
    )
  }

  if (debits.isZero()) {
    throw validation('A journal with no value has nothing to record.')
  }

  // 5. Accounts: same organisation, active, postable, and carrying the subledger
  //    dimension their control account requires.
  await assertAccountsPostable(tx, ctx, rounded)

  // 6. Period. Created on first use; must be open.
  const period = await resolvePeriod(
    tx,
    ctx.orgId,
    ctx.organization.fiscalYearStartMonth,
    draft.date,
  )

  if (period.status !== 'OPEN') {
    throw precondition(
      `The accounting period containing ${draft.date} is ${period.status.toLowerCase()}. ` +
        `Reopen it, or date this entry in an open period.`,
    )
  }

  // 7. Number, allocated under a row lock so two concurrent posts cannot collide.
  const journalNumber = draft.journalNumber
    ? await assignDocumentNumber(tx, ctx.orgId, 'JOURNAL', draft.journalNumber)
    : await nextDocumentNumber(tx, ctx.orgId, 'JOURNAL')
  if (draft.journalNumber) {
    const clash = await tx.journal.findFirst({
      where: { orgId: ctx.orgId, journalNumber },
      select: { id: true },
    })
    if (clash) throw numberTaken()
  }

  // 8. Write. The deferred balance trigger re-checks all of this at COMMIT.
  const journal = await tx.journal.create({
    data: {
      orgId: ctx.orgId,
      journalNumber,
      date: toDate(draft.date),
      periodId: period.id,
      memo: draft.memo ?? null,
      sourceType: draft.sourceType,
      sourceId: draft.sourceId ?? null,
      status: 'POSTED',
      isAdjusting: draft.isAdjusting ?? false,
      isClosingEntry: draft.isClosingEntry ?? false,
      reversalOfId: draft.reversalOfId ?? null,
      reversalReason: draft.reversalReason ?? null,
      currencyCode: currency,
      exchangeRate: 1,
      idempotencyKey: draft.idempotencyKey ?? null,
      createdById: ctx.userId,
      lines: {
        create: rounded.map((line, index) => ({
          orgId: ctx.orgId,
          lineNumber: index + 1,
          accountId: line.source.accountId,
          debit: line.debit.toFixed(4),
          credit: line.credit.toFixed(4),
          description: line.source.description ?? null,
          customerId: line.source.customerId ?? null,
          vendorId: line.source.vendorId ?? null,
          // The trigger overwrites this with the header's date; supplying it keeps
          // the column non-null in Prisma's types.
          journalDate: toDate(draft.date),
        })),
      },
    },
    select: { id: true, journalNumber: true, date: true, periodId: true },
  })

  await writeAudit(tx, ctx, {
    entity: 'Journal',
    entityId: journal.id,
    action: 'POST',
    after: {
      journalNumber: journal.journalNumber,
      date: draft.date,
      sourceType: draft.sourceType,
      total: toMoneyString(debits, 2),
      lines: rounded.length,
    },
  })

  return { ...journal, total: toMoneyString(debits, 2) }
}

/**
 * Reverse a posted journal by posting its mirror image, and mark the original
 * reversed. The ledger keeps both; the net effect is nil.
 *
 * The reversal is dated on the later of the original date and the first open
 * period, so correcting an error never reopens a month that has been reported.
 */
export async function reverseJournal(
  tx: Tx,
  ctx: OrgContext,
  journalId: string,
  options: { date?: CalendarDate; reason: string },
): Promise<PostedJournal> {
  const original = await tx.journal.findFirst({
    where: { id: journalId, orgId: ctx.orgId },
    select: {
      id: true,
      journalNumber: true,
      date: true,
      status: true,
      sourceType: true,
      sourceId: true,
      memo: true,
      isAdjusting: true,
      isClosingEntry: true,
      reversedBy: { select: { id: true, journalNumber: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          accountId: true,
          debit: true,
          credit: true,
          description: true,
          customerId: true,
          vendorId: true,
        },
      },
    },
  })

  if (!original) throw notFound('Journal')

  if (original.status === 'REVERSED') {
    throw conflict(
      `Journal ${original.journalNumber} has already been reversed by ${original.reversedBy?.journalNumber ?? 'another entry'}.`,
    )
  }
  if (original.status !== 'POSTED') {
    throw precondition('Only a posted journal can be reversed.')
  }

  const date = options.date ?? (await reversalDateFor(tx, ctx, original.date))

  const reversal = await postJournal(tx, ctx, {
    date,
    memo: `Reversal of ${original.journalNumber}${options.reason ? ` — ${options.reason}` : ''}`,
    sourceType: 'REVERSAL',
    sourceId: original.id,
    reversalOfId: original.id,
    reversalReason: options.reason,
    // A reversal inherits what the original was. Reversing an adjustment is an
    // adjustment, and reversing a year-end closing entry is part of the close —
    // if it were not, the profit and loss would leave out the sweep and count the
    // sweep coming back, and a reopened year would report double its income.
    isAdjusting: original.isAdjusting,
    isClosingEntry: original.isClosingEntry,
    lines: original.lines.map((line) => ({
      accountId: line.accountId,
      // Swap the sides. That is the whole of a reversal.
      debit: line.credit.toString(),
      credit: line.debit.toString(),
      description: line.description,
      customerId: line.customerId,
      vendorId: line.vendorId,
    })),
  })

  // The immutability trigger permits exactly this transition and nothing else.
  await tx.journal.update({
    where: { id: original.id },
    data: { status: 'REVERSED' },
  })

  await writeAudit(tx, ctx, {
    entity: 'Journal',
    entityId: original.id,
    action: 'REVERSE',
    before: { status: 'POSTED' },
    after: { status: 'REVERSED', reversedBy: reversal.journalNumber, reason: options.reason },
  })

  return reversal
}

/** Original date if its period is still open, otherwise the first date that is. */
async function reversalDateFor(tx: Tx, ctx: OrgContext, originalDate: Date): Promise<CalendarDate> {
  const asCalendar = toCalendarDate(originalDate)

  const period = await tx.accountingPeriod.findFirst({
    where: { orgId: ctx.orgId, startDate: { lte: originalDate }, endDate: { gte: originalDate } },
    select: { status: true },
  })
  if (period?.status === 'OPEN') return asCalendar

  const open = await tx.accountingPeriod.findFirst({
    where: { orgId: ctx.orgId, status: 'OPEN', endDate: { gte: originalDate } },
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  })

  if (!open) {
    throw precondition(
      'There is no open accounting period to reverse into. Reopen a period first.',
    )
  }
  return toCalendarDate(open.startDate)
}

type RoundedLine = { source: DraftLine; debit: Decimal; credit: Decimal }

async function assertAccountsPostable(tx: Tx, ctx: OrgContext, lines: RoundedLine[]): Promise<void> {
  const ids = [...new Set(lines.map((line) => line.source.accountId))]

  const accounts = await tx.ledgerAccount.findMany({
    where: { id: { in: ids }, orgId: ctx.orgId },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      systemKey: true,
      _count: { select: { children: true } },
    },
  })

  const byId = new Map(accounts.map((account) => [account.id, account]))

  for (const id of ids) {
    const account = byId.get(id)
    if (!account) {
      throw notFound('Account')
    }
    if (!account.isActive) {
      throw precondition(`Account ${account.code} ${account.name} is archived and cannot be posted to.`)
    }
    if (account._count.children > 0) {
      throw validation(
        `Account ${account.code} ${account.name} is a grouping heading. Post to one of its sub-accounts.`,
      )
    }
  }

  for (const line of lines) {
    const account = byId.get(line.source.accountId)!
    if (account.systemKey === 'ACCOUNTS_RECEIVABLE' && !line.source.customerId) {
      throw validation(
        `A line posted to ${account.name} must name a customer, so the aging report and the control account cannot disagree.`,
      )
    }
    if (account.systemKey === 'ACCOUNTS_PAYABLE' && !line.source.vendorId) {
      throw validation(
        `A line posted to ${account.name} must name a vendor, so the aging report and the control account cannot disagree.`,
      )
    }
  }
}

async function journalTotal(tx: Tx, journalId: string): Promise<string> {
  const result = await tx.journalLine.aggregate({
    where: { journalId },
    _sum: { debit: true },
  })
  return toMoneyString(result._sum.debit ?? 0, 2)
}
