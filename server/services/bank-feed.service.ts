import 'server-only'

import type { JournalSourceType } from '@prisma/client'

import { ruleFor, type RuleLike } from '@/lib/bank-feed'
import { toCalendarDate, type CalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { vendorSchema } from '@/lib/validation/master-data'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound, validation } from '@/server/errors'
import * as bankingService from '@/server/services/banking.service'
import * as billPaymentService from '@/server/services/bill-payment.service'
import * as contactService from '@/server/services/contact.service'
import * as paymentService from '@/server/services/payment.service'
import * as purchaseService from '@/server/services/purchase.service'
import * as importService from '@/server/services/statement-import.service'

/**
 * The bank feed: decide what each statement line is, then post it through the
 * same documents the rest of the books use.
 *
 * Reconciliation is not touched here. A line that a reconciliation has already
 * cleared cannot be undone from this screen — the reconciliation still owns that
 * fact.
 */

export type FeedLine = {
  id: string
  date: string
  description: string
  reference: string | null
  amount: string
  status: string
  categoryAccountId: string | null
  vendorId: string | null
  customerId: string | null
  vendorName: string | null
  customerName: string | null
  matchedTo: string | null
  matchedJournalId: string | null
  sourceType: string | null
  sourceId: string | null
  cleared: boolean
  fileCount: number
  suggestion: {
    from: 'rule' | 'memory'
    label: string
    categoryAccountId: string
    vendorId: string | null
    customerId: string | null
  } | null
}

export async function feedPage(ctx: OrgContext, accountId: string) {
  const [lines, chart, vendors, customers, invoices, bills, rules] = await Promise.all([
    linesFor(ctx, accountId),
    db.ledgerAccount.findMany({
      where: { orgId: ctx.orgId, isActive: true, type: { in: ['REVENUE', 'EXPENSE'] } },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: 'asc' },
    }),
    db.vendor.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 400,
    }),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 400,
    }),
    openInvoices(ctx),
    openBills(ctx),
    listRules(ctx),
  ])

  return {
    lines,
    categories: chart.map((account) => ({
      id: account.id,
      label: `${account.code} ${account.name}`,
      type: account.type,
    })),
    vendors: vendors.map((vendor) => ({ id: vendor.id, name: vendor.displayName })),
    customers: customers.map((customer) => ({ id: customer.id, name: customer.displayName })),
    invoices,
    bills,
    rules,
  }
}

export async function linesFor(ctx: OrgContext, accountId: string): Promise<FeedLine[]> {
  const rows = await db.importedTransaction.findMany({
    where: { orgId: ctx.orgId, accountId },
    select: {
      id: true,
      date: true,
      description: true,
      reference: true,
      amount: true,
      status: true,
      accountId: true,
      categoryAccountId: true,
      vendorId: true,
      customerId: true,
      vendor: { select: { displayName: true } },
      customer: { select: { displayName: true } },
      matchedJournalLine: {
        select: {
          id: true,
          journal: { select: { id: true, journalNumber: true, sourceType: true, sourceId: true, status: true } },
        },
      },
      _count: { select: { files: true } },
    },
    orderBy: [{ date: 'asc' }],
    take: 500,
  })

  const rules = await listRules(ctx)
  const memory = rows
    .filter((row) => row.status === 'MATCHED' && row.categoryAccountId)
    .map((row) => ({
      key: row.description.toLowerCase(),
      categoryAccountId: row.categoryAccountId as string,
      vendorId: row.vendorId,
      customerId: row.customerId,
    }))

  const lineIds = rows.map((row) => row.matchedJournalLine?.id).filter((id): id is string => Boolean(id))
  const cleared = new Set(
    lineIds.length === 0
      ? []
      : (
          await db.reconciliationEntry.findMany({
            where: { orgId: ctx.orgId, journalLineId: { in: lineIds } },
            select: { journalLineId: true },
          })
        ).map((entry) => entry.journalLineId),
  )

  return rows.map((row) => {
    const rule = ruleFor(row.description, row.accountId, rules)
    const remembered = memory.find((item) => item.key && row.description.toLowerCase().includes(item.key.slice(0, 12)))
    const suggestion = row.categoryAccountId
      ? null
      : rule
        ? {
            from: 'rule' as const,
            label: rule.name,
            categoryAccountId: rule.categoryAccountId,
            vendorId: rule.vendorId,
            customerId: rule.customerId,
          }
        : remembered
          ? {
              from: 'memory' as const,
              label: 'Used before',
              categoryAccountId: remembered.categoryAccountId,
              vendorId: remembered.vendorId,
              customerId: remembered.customerId,
            }
          : null

    return {
      id: row.id,
      date: toCalendarDate(row.date),
      description: row.description,
      reference: row.reference,
      amount: row.amount.toString(),
      status: row.status,
      categoryAccountId: row.categoryAccountId,
      vendorId: row.vendorId,
      customerId: row.customerId,
      vendorName: row.vendor?.displayName ?? null,
      customerName: row.customer?.displayName ?? null,
      matchedTo: row.matchedJournalLine?.journal.journalNumber ?? null,
      matchedJournalId: row.matchedJournalLine?.journal.id ?? null,
      sourceType: row.matchedJournalLine?.journal.sourceType ?? null,
      sourceId: row.matchedJournalLine?.journal.sourceId ?? null,
      cleared: row.matchedJournalLine ? cleared.has(row.matchedJournalLine.id) : false,
      fileCount: row._count.files,
      suggestion,
    }
  })
}

export async function listRules(ctx: OrgContext): Promise<RuleLike[]> {
  const rows = await db.bankRule.findMany({
    where: { orgId: ctx.orgId, active: true },
    select: {
      id: true,
      name: true,
      contains: true,
      accountId: true,
      categoryAccountId: true,
      vendorId: true,
      customerId: true,
    },
    orderBy: { name: 'asc' },
  })
  return rows
}

export async function openInvoices(ctx: OrgContext) {
  const docs = await db.salesDocument.findMany({
    where: { orgId: ctx.orgId, type: 'INVOICE', status: { in: ['OPEN', 'PARTIAL'] } },
    select: {
      id: true,
      number: true,
      date: true,
      customerId: true,
      customer: { select: { displayName: true } },
    },
    orderBy: { date: 'asc' },
    take: 200,
  })
  const balances = await import('@/server/services/sales.service').then((m) =>
    m.outstandingBalances(db, docs.map((doc) => doc.id)),
  )
  return docs
    .map((doc) => ({
      id: doc.id,
      number: doc.number,
      date: toCalendarDate(doc.date),
      customerId: doc.customerId,
      name: doc.customer.displayName,
      outstanding: (balances.get(doc.id) ?? new Decimal(0)).toFixed(2),
    }))
    .filter((doc) => Number(doc.outstanding) > 0)
}

export async function openBills(ctx: OrgContext) {
  const docs = await db.purchaseDocument.findMany({
    where: { orgId: ctx.orgId, type: 'BILL', status: { in: ['OPEN', 'PARTIAL'] } },
    select: {
      id: true,
      number: true,
      date: true,
      vendorId: true,
      vendor: { select: { displayName: true } },
    },
    orderBy: { date: 'asc' },
    take: 200,
  })
  const balances = await purchaseService.outstandingBalances(db, docs.map((doc) => doc.id))
  return docs
    .map((doc) => ({
      id: doc.id,
      number: doc.number,
      date: toCalendarDate(doc.date),
      vendorId: doc.vendorId,
      name: doc.vendor.displayName,
      outstanding: (balances.get(doc.id) ?? new Decimal(0)).toFixed(2),
    }))
    .filter((doc) => Number(doc.outstanding) > 0)
}

async function loadPending(ctx: OrgContext, id: string) {
  const row = await db.importedTransaction.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!row) throw notFound('Statement line')
  if (row.status !== 'PENDING') throw validation('That line has already been dealt with.')
  return row
}

export async function saveLine(
  ctx: OrgContext,
  input: {
    id: string
    categoryAccountId: string | null
    vendorId: string | null
    customerId: string | null
    payeeName: string | null
  },
) {
  const row = await loadPending(ctx, input.id)
  let vendorId = input.vendorId
  if (!vendorId && input.payeeName && row.amount.isNegative()) {
    const existing = await db.vendor.findFirst({
      where: { orgId: ctx.orgId, displayName: { equals: input.payeeName, mode: 'insensitive' } },
      select: { id: true },
    })
    vendorId = existing?.id ?? (await contactService.createVendor(ctx, vendorSchema.parse({ displayName: input.payeeName }))).id
  }

  await db.importedTransaction.update({
    where: { id: row.id },
    data: {
      categoryAccountId: input.categoryAccountId,
      vendorId,
      customerId: input.customerId,
    },
  })
  return { id: row.id, vendorId }
}

async function bankLineId(ctx: OrgContext, accountId: string, sourceType: JournalSourceType, sourceId: string) {
  const journal = await db.journal.findFirst({
    where: {
      orgId: ctx.orgId,
      sourceType,
      sourceId,
      status: { notIn: ['DRAFT', 'DELETED'] },
    },
    select: { lines: { where: { accountId }, select: { id: true } } },
    orderBy: { postedAt: 'desc' },
  })
  const lineId = journal?.lines[0]?.id
  if (!lineId) throw validation('The entry posted, but it did not land on this bank account.')
  return lineId
}

export async function postLines(ctx: OrgContext, ids: string[]) {
  if (!ctx.permissions.has('bank:transact')) throw forbidden()
  const posted: string[] = []

  for (const id of ids) {
    const row = await loadPending(ctx, id)
    if (!row.categoryAccountId) {
      throw validation(`"${row.description}" has no category yet. Choose one, then post.`)
    }
    const amount = new Decimal(row.amount.toString())
    const date = toCalendarDate(row.date)
    const magnitude = amount.abs().toFixed(2)

    if (amount.isNegative()) {
      if (!ctx.permissions.has('expense:create')) throw forbidden('You need permission to record an expense.')
      if (!row.vendorId) throw validation(`"${row.description}" needs a payee before it can be posted.`)
      const document = await purchaseService.create(ctx, 'EXPENSE', {
        number: undefined,
        saveAsDraft: false,
        vendorId: row.vendorId,
        date,
        paymentAccountId: row.accountId,
        reference: row.reference,
        memo: row.description,
        lines: [
          {
            expenseAccountId: row.categoryAccountId,
            description: row.description,
            quantity: '1',
            unitPrice: magnitude,
          },
        ],
      })
      const lineId = await bankLineId(ctx, row.accountId, 'EXPENSE', document.id)
      await importService.match(ctx, row.id, lineId)
    } else {
      const deposit = await bankingService.createDeposit(ctx, {
        number: undefined,
        date,
        bankAccountId: row.accountId,
        reference: row.reference,
        memo: row.description,
        paymentIds: [] as string[],
        otherLines: [
          { accountId: row.categoryAccountId, description: row.description, amount: magnitude },
        ],
      })
      const lineId = await bankLineId(ctx, row.accountId, 'DEPOSIT', deposit.id)
      await importService.match(ctx, row.id, lineId)
    }
    posted.push(id)
  }

  return { posted: posted.length }
}

export async function matchInvoice(ctx: OrgContext, importedId: string, invoiceId: string) {
  if (!ctx.permissions.has('payment:create')) throw forbidden()
  const row = await loadPending(ctx, importedId)
  const amount = new Decimal(row.amount.toString())
  if (!amount.isPositive()) throw validation('Only money coming in can be matched to an invoice.')

  const invoice = await db.salesDocument.findFirst({
    where: { id: invoiceId, orgId: ctx.orgId, type: 'INVOICE' },
    select: { id: true, customerId: true, number: true },
  })
  if (!invoice) throw notFound('Invoice')

  const payment = await paymentService.create(ctx, {
    number: undefined,
    customerId: invoice.customerId,
    date: toCalendarDate(row.date),
    amount: amount.toFixed(2),
    method: 'BANK_TRANSFER',
    depositAccountId: row.accountId,
    reference: row.reference,
    memo: row.description,
    applications: [{ invoiceId: invoice.id, amount: amount.toFixed(2) }],
  })
  const lineId = await bankLineId(ctx, row.accountId, 'CUSTOMER_PAYMENT', payment.id)
  await importService.match(ctx, row.id, lineId)
  await db.importedTransaction.update({
    where: { id: row.id },
    data: { customerId: invoice.customerId },
  })
  return { number: payment.number }
}

export async function matchBill(ctx: OrgContext, importedId: string, billId: string) {
  if (!ctx.permissions.has('expense:create')) throw forbidden()
  const row = await loadPending(ctx, importedId)
  const amount = new Decimal(row.amount.toString())
  if (!amount.isNegative()) throw validation('Only money going out can be matched to a bill.')

  const bill = await db.purchaseDocument.findFirst({
    where: { id: billId, orgId: ctx.orgId, type: 'BILL' },
    select: { id: true, vendorId: true },
  })
  if (!bill) throw notFound('Bill')

  const magnitude = amount.abs().toFixed(2)
  const payment = await billPaymentService.create(ctx, {
    number: undefined,
    vendorId: bill.vendorId,
    date: toCalendarDate(row.date),
    amount: magnitude,
    method: 'BANK_TRANSFER',
    paymentAccountId: row.accountId,
    reference: row.reference,
    memo: row.description,
    applications: [{ billId: bill.id, amount: magnitude }],
  })
  const lineId = await bankLineId(ctx, row.accountId, 'BILL_PAYMENT', payment.id)
  await importService.match(ctx, row.id, lineId)
  await db.importedTransaction.update({
    where: { id: row.id },
    data: { vendorId: bill.vendorId },
  })
  return { number: payment.number }
}

const UNDOABLE = new Set<JournalSourceType>(['EXPENSE', 'DEPOSIT', 'CUSTOMER_PAYMENT', 'BILL_PAYMENT'])

export async function undoLine(ctx: OrgContext, importedId: string) {
  const row = await db.importedTransaction.findFirst({
    where: { id: importedId, orgId: ctx.orgId },
    select: {
      id: true,
      status: true,
      matchedJournalLine: {
        select: {
          id: true,
          journal: { select: { sourceType: true, sourceId: true, status: true } },
        },
      },
    },
  })
  if (!row) throw notFound('Statement line')
  if (row.status !== 'MATCHED' || !row.matchedJournalLine) {
    throw validation('Only a posted line can be put back.')
  }

  const cleared = await db.reconciliationEntry.findFirst({
    where: { journalLineId: row.matchedJournalLine.id },
    select: { id: true },
  })
  if (cleared) {
    throw validation(
      'This line is already cleared on a reconciliation. Undo that reconciliation before changing the line. The reconciliation itself is left as it is.',
    )
  }

  const source = row.matchedJournalLine.journal
  if (!source.sourceId || !UNDOABLE.has(source.sourceType) || source.status === 'DELETED') {
    throw validation('This line was matched to an entry made somewhere else. Leave the match, or exclude the line.')
  }

  const reason = 'Put back from the bank feed so it can be entered again.'
  if (source.sourceType === 'EXPENSE') await purchaseService.remove(ctx, source.sourceId, reason)
  if (source.sourceType === 'DEPOSIT') await bankingService.removeDeposit(ctx, source.sourceId, reason)
  if (source.sourceType === 'CUSTOMER_PAYMENT') await paymentService.remove(ctx, source.sourceId, reason)
  if (source.sourceType === 'BILL_PAYMENT') await billPaymentService.remove(ctx, source.sourceId, reason)

  await db.importedTransaction.update({
    where: { id: row.id },
    data: { status: 'PENDING', matchedJournalLineId: null, matchedAt: null },
  })
  return { id: row.id }
}

/** A line typed on the account's own register, posted the same way as the feed. */
export async function recordOnAccount(
  ctx: OrgContext,
  input: {
    accountId: string
    direction: 'in' | 'out'
    date: CalendarDate
    amount: string
    categoryAccountId: string
    vendorId: string | null
    payeeName: string | null
    memo: string | null
  },
) {
  if (!ctx.permissions.has('bank:transact')) throw forbidden()
  const account = await db.ledgerAccount.findFirst({
    where: { id: input.accountId, orgId: ctx.orgId, isActive: true },
    select: { id: true, subtype: true },
  })
  if (!account) throw notFound('Account')
  if (!['BANK', 'CREDIT_CARD', 'OTHER_CURRENT_ASSET', 'UNDEPOSITED_FUNDS'].includes(account.subtype)) {
    throw validation('Type this on a bank, card, or cash account.')
  }

  let vendorId = input.vendorId
  if (input.direction === 'out') {
    if (!ctx.permissions.has('expense:create')) throw forbidden()
    if (!vendorId && input.payeeName) {
      const existing = await db.vendor.findFirst({
        where: { orgId: ctx.orgId, displayName: { equals: input.payeeName, mode: 'insensitive' } },
        select: { id: true },
      })
      vendorId =
        existing?.id ??
        (await contactService.createVendor(ctx, vendorSchema.parse({ displayName: input.payeeName }))).id
    }
    if (!vendorId) throw validation('Name who was paid.')
    const document = await purchaseService.create(ctx, 'EXPENSE', {
      number: undefined,
      saveAsDraft: false,
      vendorId,
      date: input.date,
      paymentAccountId: account.id,
      memo: input.memo,
      lines: [
        {
          expenseAccountId: input.categoryAccountId,
          description: input.memo,
          quantity: '1',
          unitPrice: input.amount,
        },
      ],
    })
    return { id: document.id, href: `/purchases/expenses/${document.id}` }
  }

  const deposit = await bankingService.createDeposit(ctx, {
    number: undefined,
    date: input.date,
    bankAccountId: account.id,
    memo: input.memo,
    paymentIds: [] as string[],
    otherLines: [{ accountId: input.categoryAccountId, description: input.memo, amount: input.amount }],
  })
  return { id: deposit.id, href: '/banking/accounts' }
}

export async function createRule(
  ctx: OrgContext,
  input: {
    name: string
    contains: string
    accountId: string | null
    categoryAccountId: string
    vendorId: string | null
    customerId: string | null
  },
) {
  const category = await db.ledgerAccount.findFirst({
    where: { id: input.categoryAccountId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!category) throw notFound('Category')

  return db.bankRule.create({
    data: {
      orgId: ctx.orgId,
      name: input.name,
      contains: input.contains.trim(),
      accountId: input.accountId,
      categoryAccountId: input.categoryAccountId,
      vendorId: input.vendorId,
      customerId: input.customerId,
    },
    select: { id: true, name: true },
  })
}
