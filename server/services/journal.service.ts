import 'server-only'
import type { JournalSourceType, Prisma } from '@prisma/client'

import { isCalendarDate, toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, parseMoneyInput, toMoneyString } from '@/lib/money'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { ManualJournalInput } from '@/lib/validation/accounting'
import { partyRequiredBy } from '@/lib/account-options'
import { deleteJournals } from '@/server/accounting/deletion'
import { postJournal, reverseJournal } from '@/server/accounting/posting'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'
import * as bankingService from '@/server/services/banking.service'
import * as billPaymentService from '@/server/services/bill-payment.service'
import * as inventoryService from '@/server/services/inventory.service'
import { resolveSources, sourceFor, type JournalSource } from '@/server/services/journal-sources'
import * as paymentService from '@/server/services/payment.service'
import * as purchaseService from '@/server/services/purchase.service'
import * as salesService from '@/server/services/sales.service'

export type JournalRow = {
  id: string
  journalNumber: string
  date: Date
  postedAt: Date
  memo: string | null
  sourceType: string
  status: string
  isAdjusting: boolean
  total: string
  lineCount: number
  /** The document that produced it, and who it was with. */
  source: JournalSource
  /** Present on the full month list, so a row can open its lines on hover. */
  lines?: { account: string; description: string | null; debit: string; credit: string }[]
}

/** Orderings the list screen offers. Sorting happens here, over every row. */
const JOURNAL_ORDER: Record<string, (dir: 'asc' | 'desc') => Prisma.JournalOrderByWithRelationInput[]> = {
  number: (dir) => [{ journalNumber: dir }],
  date: (dir) => [{ date: dir }, { journalNumber: dir }],
  memo: (dir) => [{ memo: dir }, { date: 'desc' }],
  source: (dir) => [{ sourceType: dir }, { date: 'desc' }],
  status: (dir) => [{ status: dir }, { date: 'desc' }],
}

export async function list(
  ctx: OrgContext,
  query: ListQuery,
  options: {
    sort?: string
    dir?: 'asc' | 'desc'
    sourceType?: JournalSourceType
    from?: CalendarDate
    to?: CalendarDate
    /** Every row in the range, so a month can be scrolled from A to Z. */
    unpaged?: boolean
  } = {},
) {
  const where: Prisma.JournalWhereInput = {
    orgId: ctx.orgId,
    // A deleted entry is gone from this list for the same reason it is gone from
    // every balance. The row survives and its own page still reads, so a link in
    // an audit record still resolves.
    status: { not: 'DELETED' },
    ...(options.sourceType ? { sourceType: options.sourceType } : {}),
    ...(options.from || options.to
      ? {
          date: {
            ...(options.from ? { gte: toDate(options.from) } : {}),
            ...(options.to ? { lte: toDate(options.to) } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            { journalNumber: { contains: query.q, mode: 'insensitive' } },
            { memo: { contains: query.q, mode: 'insensitive' } },
            // A journal is normally looked for by the customer or vendor it was
            // with, which lives on its lines rather than on the header.
            {
              lines: {
                some: { customer: { displayName: { contains: query.q, mode: 'insensitive' } } },
              },
            },
            {
              lines: {
                some: { vendor: { displayName: { contains: query.q, mode: 'insensitive' } } },
              },
            },
          ],
        }
      : {}),
  }

  const [journals, total] = await Promise.all([
    db.journal.findMany({
      where,
      select: {
        id: true,
        journalNumber: true,
        date: true,
        postedAt: true,
        memo: true,
        sourceType: true,
        sourceId: true,
        status: true,
        isAdjusting: true,
        lines: {
          select: {
            lineNumber: true,
            debit: true,
            credit: true,
            description: true,
            account: { select: { code: true, name: true } },
            customer: { select: { id: true, displayName: true } },
            vendor: { select: { id: true, displayName: true } },
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
      orderBy:
        (options.sort ? JOURNAL_ORDER[options.sort]?.(options.dir ?? 'asc') : undefined) ??
        [{ date: 'desc' }, { journalNumber: 'desc' }],
      ...(options.unpaged ? {} : paginate(query)),
    }),
    db.journal.count({ where }),
  ])

  // Which document each journal came from, and who it was with — resolved in
  // one batch per family rather than one query per row.
  const sources = await resolveSources(
    ctx.orgId,
    journals.map((journal) => ({ sourceType: journal.sourceType, sourceId: journal.sourceId })),
  )

  const rows: JournalRow[] = journals.map((journal) => {
    const source = sourceFor(sources, { sourceType: journal.sourceType, sourceId: journal.sourceId })
    // A manual entry has no document, so the name is the one written on its lines.
    const named = journal.lines.find((line) => line.customer || line.vendor)
    const party = named?.customer
      ? { partyName: named.customer.displayName, partyHref: `/customers?id=${named.customer.id}` }
      : named?.vendor
        ? { partyName: named.vendor.displayName, partyHref: `/vendors/${named.vendor.id}` }
        : null

    return {
      id: journal.id,
      journalNumber: journal.journalNumber,
      date: journal.date,
      postedAt: journal.postedAt,
      memo: journal.memo,
      sourceType: journal.sourceType,
      status: journal.status,
      isAdjusting: journal.isAdjusting,
      // A journal's "amount" is one side of it — debits and credits are equal by
      // construction, so summing both would double it.
      total: toMoneyString(
        journal.lines.reduce((sum, line) => sum.plus(new Decimal(line.debit.toString())), new Decimal(0)),
        2,
      ),
      lineCount: journal.lines.length,
      source: source.partyName || !party ? source : { ...source, ...party },
      ...(options.unpaged
        ? {
            lines: journal.lines.map((line) => ({
              account: `${line.account.code} ${line.account.name}`,
              description: line.description,
              debit: toMoneyString(line.debit.toString(), 2),
              credit: toMoneyString(line.credit.toString(), 2),
            })),
          }
        : {}),
    }
  })

  if (options.unpaged) {
    return { rows, total, page: 1, pageSize: Math.max(total, 1), pageCount: 1 }
  }
  return paged(rows, total, query)
}

/** Recent lines for the journal form's lower list. One row is one posted line. */
export async function registerLines(ctx: OrgContext) {
  const lines = await db.journalLine.findMany({
    where: { orgId: ctx.orgId, journal: { status: { not: 'DELETED' } } },
    select: {
      id: true,
      debit: true,
      credit: true,
      description: true,
      journalDate: true,
      account: { select: { code: true, name: true } },
      journal: {
        select: {
          id: true,
          journalNumber: true,
          memo: true,
          isAdjusting: true,
          sourceType: true,
        },
      },
    },
    orderBy: [{ journalDate: 'desc' }, { lineNumber: 'asc' }],
    take: 40,
  })

  return lines.map((line) => {
    const debit = new Decimal(line.debit.toString())
    const credit = new Decimal(line.credit.toString())
    return {
      lineId: line.id,
      journalId: line.journal.id,
      date: toCalendarDate(line.journalDate),
      number: line.journal.journalNumber,
      adjusting: line.journal.isAdjusting,
      manual: line.journal.sourceType === 'MANUAL',
      account: `${line.account.code} — ${line.account.name}`,
      memo: line.description ?? line.journal.memo,
      amount: toMoneyString(debit.isZero() ? credit : debit, 2),
    }
  })
}

/**
 * Find a posted journal by its number, its date, or an amount.
 *
 * An empty search returns the latest entries, so opening Find shows what is
 * already in the books. An amount matches either the entry's debit total or
 * any one line.
 */
export async function find(
  ctx: OrgContext,
  input: { number?: string; date?: string; amount?: string },
) {
  const number = input.number?.trim()
  const date = input.date?.trim()
  const amount = input.amount?.trim()
  const money = amount ? parseMoneyInput(amount) : null
  const rounded = money?.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) ?? null

  // The amount is the entry's debit total, or any one line. The total is a sum,
  // so it cannot be a column filter — an opening balance of 10,200 is found
  // here even when no single line is exactly that figure.
  let amountIds: string[] | undefined
  if (rounded) {
    const low = rounded.toFixed(2)
    const high = rounded.plus('0.005').toFixed(4)
    const hits = await db.$queryRaw<{ id: string }[]>`
      SELECT j.id
      FROM journals j
      JOIN journal_lines l ON l."journalId" = j.id
      WHERE j."orgId" = ${ctx.orgId}
        AND j.status::text <> 'DELETED'
      GROUP BY j.id
      HAVING
        (SUM(l.debit) >= ${low}::numeric AND SUM(l.debit) < ${high}::numeric)
        OR BOOL_OR(l.debit >= ${low}::numeric AND l.debit < ${high}::numeric)
        OR BOOL_OR(l.credit >= ${low}::numeric AND l.credit < ${high}::numeric)
      ORDER BY MAX(j.date) DESC, MAX(j."journalNumber") DESC
      LIMIT 20
    `
    amountIds = hits.map((hit) => hit.id)
    if (amountIds.length === 0) return []
  }

  const journals = await db.journal.findMany({
    where: {
      orgId: ctx.orgId,
      status: { not: 'DELETED' },
      ...(amountIds ? { id: { in: amountIds } } : {}),
      ...(number ? { journalNumber: { contains: number, mode: 'insensitive' } } : {}),
      ...(date && isCalendarDate(date) ? { date: toDate(date) } : {}),
    },
    select: {
      id: true,
      journalNumber: true,
      date: true,
      memo: true,
      isAdjusting: true,
      lines: {
        select: {
          debit: true,
          credit: true,
          customer: { select: { displayName: true } },
          vendor: { select: { displayName: true } },
        },
      },
    },
    orderBy: [{ date: 'desc' }, { journalNumber: 'desc' }],
    take: 20,
  })

  return journals.map((journal) => {
    const total = journal.lines.reduce(
      (sum, line) => sum.plus(new Decimal(line.debit.toString())),
      new Decimal(0),
    )
    const party =
      journal.lines.find((line) => line.customer)?.customer?.displayName ??
      journal.lines.find((line) => line.vendor)?.vendor?.displayName ??
      null
    return {
      id: journal.id,
      number: journal.journalNumber,
      date: toCalendarDate(journal.date),
      memo: journal.memo,
      adjusting: journal.isAdjusting,
      party,
      total: toMoneyString(total, 2),
    }
  })
}

export async function get(ctx: OrgContext, id: string) {
  const journal = await db.journal.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      journalNumber: true,
      date: true,
      memo: true,
      sourceType: true,
      sourceId: true,
      status: true,
      isAdjusting: true,
      isClosingEntry: true,
      currencyCode: true,
      postedAt: true,
      deletedAt: true,
      deleteReason: true,
      reversalReason: true,
      reversalOf: { select: { id: true, journalNumber: true, date: true } },
      reversedBy: { select: { id: true, journalNumber: true, date: true } },
      period: {
        select: { id: true, periodNumber: true, startDate: true, endDate: true, status: true },
      },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          lineNumber: true,
          debit: true,
          credit: true,
          description: true,
          account: { select: { id: true, code: true, name: true, type: true } },
          // A line against a control account carries its counterparty (R7).
          // Showing it is what turns "Accounts receivable 1,200" into
          // "Accounts receivable 1,200 — Ahmed Trading".
          customer: { select: { id: true, displayName: true } },
          vendor: { select: { id: true, displayName: true } },
        },
      },
    },
  })

  if (!journal) throw notFound('Journal')

  const sources = await resolveSources(ctx.orgId, [
    { sourceType: journal.sourceType, sourceId: journal.sourceId },
  ])

  const totalDebit = journal.lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.debit.toString())),
    new Decimal(0),
  )
  const totalCredit = journal.lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.credit.toString())),
    new Decimal(0),
  )

  return {
    ...journal,
    source: sourceFor(sources, { sourceType: journal.sourceType, sourceId: journal.sourceId }),
    lines: journal.lines.map((line) => ({
      ...line,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
    })),
    totalDebit: toMoneyString(totalDebit, 2),
    totalCredit: toMoneyString(totalCredit, 2),
    balanced: totalDebit.equals(totalCredit),
  }
}

/**
 * Post a manual journal.
 *
 * Manual entry is the one place a human chooses both sides, so it is the one
 * place the subledger dimensions have to be asked for rather than derived.
 *
 * It used to refuse receivables, payables and inventory outright. That was the
 * wrong call twice over. Half the entries a business actually makes by hand are
 * against exactly those accounts — writing off a bad debt, recording a customer
 * payment that arrived without an invoice, opening a set of books, settling a
 * vendor balance from petty cash — and a system that refuses them is a system
 * where those things simply do not get recorded. And the protection was
 * illusory: the ledger already refuses an unnamed control-account line (R7), so
 * the only thing the ban bought was the inability to name one.
 *
 * What replaces it is the rule the ledger itself enforces: a receivables line
 * names a customer, a payables line names a vendor, and a party may not be
 * attached to a line that has no business carrying one. Aging then continues to
 * agree with the control account, because the aging reports read the control
 * account (see `receivables.service`).
 */
export async function createManual(ctx: OrgContext, input: ManualJournalInput) {
  const lines = input.lines
    .map((line) => ({
      accountId: line.accountId,
      debit: line.debit.trim(),
      credit: line.credit.trim(),
      description: line.description.trim() || null,
      customerId: line.customerId ?? null,
      vendorId: line.vendorId ?? null,
    }))
    .filter((line) => line.accountId && (line.debit !== '' || line.credit !== ''))

  if (lines.length < 2) {
    throw validation('Enter at least two lines: something debited and something credited.')
  }

  const accounts = await db.ledgerAccount.findMany({
    where: { orgId: ctx.orgId, id: { in: lines.map((line) => line.accountId) } },
    select: { id: true, code: true, name: true, subtype: true },
  })
  const byId = new Map(accounts.map((account) => [account.id, account]))

  const fieldErrors: Record<string, string[]> = {}
  const complain = (index: number, field: string, message: string) => {
    fieldErrors[`lines.${index}.${field}`] = [message]
  }

  lines.forEach((line, index) => {
    const account = byId.get(line.accountId)
    if (!account) {
      complain(index, 'accountId', 'That account no longer exists.')
      return
    }

    const requires = partyRequiredBy(account.subtype)

    if (requires === 'customer' && !line.customerId) {
      complain(
        index,
        'customerId',
        `${account.name} is a receivables account. Say whose balance this moves.`,
      )
    }
    if (requires === 'vendor' && !line.vendorId) {
      complain(
        index,
        'vendorId',
        `${account.name} is a payables account. Say whose balance this moves.`,
      )
    }

    // A name is welcome on any line — who an expense was with is worth recording
    // whatever account it landed in. What is refused is a name of the *wrong
    // kind* on a control account, because that is the one place the name is not
    // a note but a subledger balance: a vendor on a receivables line would put
    // the aging report and the control account permanently out of step.
    if (requires === 'customer' && line.vendorId) {
      complain(index, 'vendorId', `${account.name} is a receivables account. Name a customer, not a vendor.`)
    }
    if (requires === 'vendor' && line.customerId) {
      complain(index, 'customerId', `${account.name} is a payables account. Name a vendor, not a customer.`)
    }
    if (line.customerId && line.vendorId) {
      complain(index, 'vendorId', 'A line carries one name, not two.')
    }
  })

  if (Object.keys(fieldErrors).length > 0) {
    throw validation(
      'Some lines are missing the customer or vendor their account requires.',
      fieldErrors,
    )
  }

  await assertPartiesExist(ctx, lines)

  return db.$transaction((tx) =>
    postJournal(tx, ctx, {
      date: input.date,
      memo: input.memo,
      journalNumber: input.number,
      sourceType: 'MANUAL',
      isAdjusting: input.isAdjusting,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit === '' ? 0 : line.debit,
        credit: line.credit === '' ? 0 : line.credit,
        description: line.description,
        customerId: line.customerId,
        vendorId: line.vendorId,
      })),
    }),
  )
}

/** A named party has to be one of this organisation's, not merely a valid id. */
async function assertPartiesExist(
  ctx: OrgContext,
  lines: { customerId: string | null; vendorId: string | null }[],
) {
  const customerIds = [...new Set(lines.map((line) => line.customerId).filter(Boolean) as string[])]
  const vendorIds = [...new Set(lines.map((line) => line.vendorId).filter(Boolean) as string[])]

  const [customers, vendors] = await Promise.all([
    customerIds.length
      ? db.customer.count({ where: { orgId: ctx.orgId, id: { in: customerIds } } })
      : 0,
    vendorIds.length ? db.vendor.count({ where: { orgId: ctx.orgId, id: { in: vendorIds } } }) : 0,
  ])

  if (customers !== customerIds.length) throw notFound('Customer')
  if (vendors !== vendorIds.length) throw notFound('Vendor')
}

/**
 * Delete a journal entry.
 *
 * A journal that a document produced is not deleted on its own: the invoice, bill
 * or payment that caused it would still be sitting in its list claiming to be
 * posted. So the delete is routed to that document's own service, which withdraws
 * the pair together. That is not an alternative offered instead of deleting — the
 * person clicked Delete and the transaction is deleted; it is only the question of
 * which record is the transaction.
 *
 * A manual entry has no document behind it, and is withdrawn directly.
 */
export async function remove(ctx: OrgContext, id: string, reason?: string | null) {
  const journal = await db.journal.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, journalNumber: true, sourceType: true, sourceId: true, status: true },
  })
  if (!journal) throw notFound('Journal')
  if (journal.status === 'DELETED') return { id, number: journal.journalNumber }

  if (journal.sourceId) {
    const owner = OWNED_BY[journal.sourceType]
    if (owner) return owner(ctx, journal.sourceId, reason)
  }

  return db.$transaction(async (tx) => {
    await deleteJournals(tx, ctx, [id], reason)
    return { id, number: journal.journalNumber }
  })
}

/**
 * Which service owns the transaction behind a journal.
 *
 * A closing entry and a reversal are deliberately absent: the first is undone by
 * reopening the year, and the second goes with whatever it reversed.
 */
const OWNED_BY: Partial<
  Record<
    JournalSourceType,
    (ctx: OrgContext, id: string, reason?: string | null) => Promise<{ id: string; number: string }>
  >
> = {
  INVOICE: (ctx, id, reason) => salesService.remove(ctx, id, reason),
  SALES_RECEIPT: (ctx, id, reason) => salesService.remove(ctx, id, reason),
  CREDIT_MEMO: (ctx, id, reason) => salesService.remove(ctx, id, reason),
  REFUND_RECEIPT: (ctx, id, reason) => salesService.remove(ctx, id, reason),
  CUSTOMER_PAYMENT: (ctx, id, reason) => paymentService.remove(ctx, id, reason),
  BILL: (ctx, id, reason) => purchaseService.remove(ctx, id, reason),
  EXPENSE: (ctx, id, reason) => purchaseService.remove(ctx, id, reason),
  VENDOR_CREDIT: (ctx, id, reason) => purchaseService.remove(ctx, id, reason),
  BILL_PAYMENT: (ctx, id, reason) => billPaymentService.remove(ctx, id, reason),
  TRANSFER: (ctx, id, reason) => bankingService.removeTransfer(ctx, id, reason),
  DEPOSIT: (ctx, id, reason) => bankingService.removeDeposit(ctx, id, reason),
  INVENTORY_ADJUSTMENT: (ctx, id, reason) => inventoryService.removeAdjustment(ctx, id, reason),
}

export async function reverse(
  ctx: OrgContext,
  input: { journalId: string; reason: string; date?: string },
) {
  return db.$transaction((tx) =>
    reverseJournal(tx, ctx, input.journalId, { reason: input.reason, date: input.date }),
  )
}
