import 'server-only'
import type { DocumentType, Prisma, SalesDocumentType } from '@prisma/client'

import { endOfMonth, isCalendarDate, startOfMonth, toCalendarDate, toDate, today, type CalendarDate } from '@/lib/date'
import { isCollectionOverdue } from '@/lib/invoice-overdue'
import { Decimal, parseMoneyInput, toMoneyString, ZERO } from '@/lib/money'
import { dueDateFor } from '@/lib/payment-terms'
import { isCashMethodName } from '@/lib/pos-payment'
import { posPostedAccounts } from '@/lib/pos-register-posting'
import { byType as salesByType } from '@/lib/sales-types'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { SalesDocumentInput } from '@/lib/validation/sales'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { CLEAR_DELETION, restoreSoftDeletedDocument, softDeleteDocument } from '@/server/accounting/deletion'
import { positionOf, recordMovement, restoreMovementsFor, reverseMovementsFor } from '@/server/accounting/inventory'
import { postJournal, reverseJournal } from '@/server/accounting/posting'
import { priceDocument, type DraftSalesLine } from '@/server/accounting/sales-pricing'
import {
  buildCreditMemoJournal,
  buildInvoiceJournal,
  buildRefundReceiptJournal,
  buildSalesReceiptJournal,
  POSTS_A_JOURNAL,
  type SalesJournalInput,
} from '@/server/accounting/builders/sales'
import type { TaxCodeShape } from '@/server/accounting/tax'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'
import * as storeService from '@/server/services/store.service'
import * as salesDelivery from '@/server/services/sales-delivery.service'
import { loadCodeForCalculation } from '@/server/services/tax.service'

function documentDiscount(input: SalesDocumentInput) {
  if (!input.discountValue) return null
  return { kind: input.discountKind, value: input.discountValue }
}

/** Till metadata written before a POS sales receipt is posted. */
export type PosCheckoutMeta = {
  registerId: string
  sessionId: string
  /** Gross tendered. May add up to more than the sale when cash was handed back. */
  payments: { paymentMethodId: string; ledgerAccountId: string; amount: string }[]
  /** Outgoing movement. Null on an exact tender and on sales from before change was recorded. */
  change: { paymentMethodId: string; ledgerAccountId: string; amount: string } | null
  /**
   * Register bank account the journal debits. Null keeps the historical
   * behaviour: each payment posts to its own wallet account.
   */
  depositLedgerAccountId?: string | null
}

async function salesDiscountAccountId(tx: Tx, orgId: string) {
  const account = await tx.ledgerAccount.findFirst({
    where: { orgId, subtype: 'SALES_DISCOUNTS', isActive: true },
    select: { id: true },
    orderBy: { code: 'asc' },
  })
  if (!account) {
    throw precondition('The Sales Discounts account is missing from the chart, so a discount cannot be posted.')
  }
  return account.id
}

const SEQUENCE_FOR: Record<SalesDocumentType, DocumentType> = {
  INVOICE: 'INVOICE',
  ESTIMATE: 'ESTIMATE',
  QUOTATION: 'QUOTATION',
  SALES_ORDER: 'SALES_ORDER',
  SALES_RECEIPT: 'SALES_RECEIPT',
  CREDIT_MEMO: 'CREDIT_MEMO',
  REFUND_RECEIPT: 'REFUND_RECEIPT',
}

const DOCUMENT_SELECT = {
  id: true, type: true, number: true, date: true, dueDate: true, expiryDate: true, createdAt: true,
  promisedDate: true, promiseNote: true, excludeFromOverdue: true,
  status: true, reference: true, memo: true, customerMessage: true,
  subtotal: true, discountAmount: true, taxTotal: true, total: true,
  currencyCode: true, depositAccountId: true, journalId: true, version: true,
  voidedAt: true, voidReason: true, convertedFromId: true, paymentTermId: true,
  createdById: true,
  customer: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      billingLine1: true,
      billingLine2: true,
      billingCity: true,
      billingRegion: true,
      salesPerson: true,
    },
  },
  paymentTerm: { select: { id: true, name: true, type: true, dueDays: true } },
  depositAccount: { select: { id: true, code: true, name: true } },
  convertedTo: { select: { id: true, number: true, type: true } },
  convertedFrom: { select: { id: true, number: true, type: true } },
} satisfies Prisma.SalesDocumentSelect

/* --- Reading -------------------------------------------------------------- */

/** Orderings the list screen offers. Sorting happens here, over every row. */
const SALES_ORDER: Record<string, (dir: 'asc' | 'desc') => Prisma.SalesDocumentOrderByWithRelationInput[]> = {
  number: (dir) => [{ number: dir }],
  date: (dir) => [{ date: dir }, { number: dir }],
  customer: (dir) => [{ customer: { displayName: dir } }, { date: 'desc' }],
  dueDate: (dir) => [{ dueDate: dir }, { number: 'desc' }],
  total: (dir) => [{ total: dir }, { date: 'desc' }],
  status: (dir) => [{ status: dir }, { date: 'desc' }],
}

export async function list(
  ctx: OrgContext,
  type: SalesDocumentType,
  query: ListQuery,
  options: {
    status?: string
    customerId?: string
    sort?: string
    dir?: 'asc' | 'desc'
    from?: CalendarDate
    to?: CalendarDate
  } = {},
) {
  const where: Prisma.SalesDocumentWhereInput = {
    orgId: ctx.orgId,
    type,
    ...(options.customerId ? { customerId: options.customerId } : {}),
    ...(options.status === 'open' ? { status: { in: ['OPEN', 'PARTIAL'] } } : {}),
    ...(options.status === 'overdue'
      ? (() => {
          const asOf = toDate(today(ctx.organization.timeZone))
          return {
            status: { in: ['OPEN' as const, 'PARTIAL' as const] },
            excludeFromOverdue: false,
            OR: [
              { promisedDate: { lt: asOf } },
              { AND: [{ promisedDate: null }, { dueDate: { lt: asOf } }] },
            ],
          }
        })()
      : {}),
    ...(options.status === 'draft' ? { status: 'DRAFT' } : {}),
    ...(options.status === 'notdue'
      ? (() => {
          const asOf = toDate(today(ctx.organization.timeZone))
          return {
            status: { in: ['OPEN' as const, 'PARTIAL' as const] },
            OR: [
              { excludeFromOverdue: true },
              {
                AND: [
                  { excludeFromOverdue: false },
                  {
                    OR: [
                      { promisedDate: { gte: asOf } },
                      {
                        AND: [
                          { promisedDate: null },
                          { OR: [{ dueDate: null }, { dueDate: { gte: asOf } }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }
        })()
      : {}),
    ...(options.status === 'paid' ? { status: 'PAID' } : {}),
    ...(options.status === 'accepted' ? { status: 'ACCEPTED' } : {}),
    ...(options.status === 'declined' ? { status: 'DECLINED' } : {}),
    ...(options.status === 'invoiced'
      ? type === 'SALES_ORDER'
        ? { status: 'CLOSED' as const, convertedTo: { is: { type: 'INVOICE' as const } } }
        : { status: 'CLOSED' as const }
      : {}),
    ...(options.status === 'receipt' && type === 'SALES_ORDER'
      ? { status: 'CLOSED' as const, convertedTo: { is: { type: 'SALES_RECEIPT' as const } } }
      : {}),
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
            { number: { contains: query.q, mode: 'insensitive' } },
            { reference: { contains: query.q, mode: 'insensitive' } },
            { customer: { displayName: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.salesDocument.findMany({
      where,
      // The applied count comes back with the row so a list can say what
      // deleting one would release without a second query per row.
      select: {
        ...DOCUMENT_SELECT,
        _count: { select: { applications: true, creditsApplied: true } },
      },
      orderBy:
        (options.sort ? SALES_ORDER[options.sort]?.(options.dir ?? 'asc') : undefined) ??
        [{ date: 'desc' }, { number: 'desc' }],
      ...paginate(query),
    }),
    db.salesDocument.count({ where }),
  ])

  const balances = await outstandingBalances(db, rows.map((row) => row.id))

  return paged(
    rows.map((row) => ({
      ...serialise(row),
      balance: toMoneyString(balances.get(row.id) ?? new Decimal(row.total.toString()), 2),
      appliedCount: row._count.applications + row._count.creditsApplied,
    })),
    total,
    query,
  )
}

/**
 * Figures for the invoice home. Unpaid is what is still owed. Overdue and
 * not-due split that same balance, so they add back to unpaid. Paid is money
 * already settled. Drafts have not been sent.
 */
export async function invoiceHome(ctx: OrgContext) {
  const now = today(ctx.organization.timeZone)
  const rows = await db.salesDocument.findMany({
    where: { orgId: ctx.orgId, type: 'INVOICE', deletedAt: null, status: { not: 'VOID' } },
    select: {
      id: true,
      status: true,
      dueDate: true,
      promisedDate: true,
      excludeFromOverdue: true,
      total: true,
    },
  })
  const openIds = rows.filter((row) => row.status === 'OPEN' || row.status === 'PARTIAL').map((row) => row.id)
  const balances = await outstandingBalances(db, openIds)

  let unpaid = ZERO
  let overdue = ZERO
  let notDue = ZERO
  let paid = ZERO
  let draftTotal = ZERO
  let unpaidCount = 0
  let overdueCount = 0
  let notDueCount = 0
  let paidCount = 0
  let draftCount = 0

  for (const row of rows) {
    if (row.status === 'DRAFT') {
      draftCount += 1
      draftTotal = draftTotal.plus(row.total.toString())
      continue
    }
    if (row.status === 'PAID') {
      paidCount += 1
      paid = paid.plus(row.total.toString())
      continue
    }
    if (row.status !== 'OPEN' && row.status !== 'PARTIAL') continue
    const owing = balances.get(row.id) ?? new Decimal(row.total.toString())
    unpaid = unpaid.plus(owing)
    unpaidCount += 1
    if (isCollectionOverdue(row, now)) {
      overdue = overdue.plus(owing)
      overdueCount += 1
    } else {
      notDue = notDue.plus(owing)
      notDueCount += 1
    }
  }

  return {
    unpaid: toMoneyString(unpaid, 2),
    unpaidCount,
    overdue: toMoneyString(overdue, 2),
    overdueCount,
    notDue: toMoneyString(notDue, 2),
    notDueCount,
    paid: toMoneyString(paid, 2),
    paidCount,
    draftTotal: toMoneyString(draftTotal, 2),
    draftCount,
  }
}

/**
 * Figures for the estimate / quotation home. Open is still waiting; accepted and
 * declined are the customer's answer; invoiced means it already became a sale.
 */
export async function estimateHome(
  ctx: OrgContext,
  type: Extract<SalesDocumentType, 'ESTIMATE' | 'QUOTATION'> = 'ESTIMATE',
) {
  const rows = await db.salesDocument.findMany({
    where: { orgId: ctx.orgId, type, deletedAt: null, status: { not: 'VOID' } },
    select: { id: true, status: true, total: true },
  })

  let open = ZERO
  let accepted = ZERO
  let declined = ZERO
  let invoiced = ZERO
  let draftTotal = ZERO
  let openCount = 0
  let acceptedCount = 0
  let declinedCount = 0
  let invoicedCount = 0
  let draftCount = 0

  for (const row of rows) {
    const amount = new Decimal(row.total.toString())
    if (row.status === 'DRAFT') {
      draftCount += 1
      draftTotal = draftTotal.plus(amount)
      continue
    }
    if (row.status === 'ACCEPTED') {
      acceptedCount += 1
      accepted = accepted.plus(amount)
      continue
    }
    if (row.status === 'DECLINED') {
      declinedCount += 1
      declined = declined.plus(amount)
      continue
    }
    if (row.status === 'CLOSED') {
      invoicedCount += 1
      invoiced = invoiced.plus(amount)
      continue
    }
    if (row.status === 'OPEN') {
      openCount += 1
      open = open.plus(amount)
    }
  }

  return {
    open: toMoneyString(open, 2),
    openCount,
    accepted: toMoneyString(accepted, 2),
    acceptedCount,
    declined: toMoneyString(declined, 2),
    declinedCount,
    invoiced: toMoneyString(invoiced, 2),
    invoicedCount,
    draftTotal: toMoneyString(draftTotal, 2),
    draftCount,
  }
}

/**
 * Figures for the sales-order home. Open is waiting for the customer to
 * collect. Invoiced and receipt are the two ways that collection was recorded.
 */
export async function salesOrderHome(ctx: OrgContext) {
  const rows = await db.salesDocument.findMany({
    where: { orgId: ctx.orgId, type: 'SALES_ORDER', deletedAt: null, status: { not: 'VOID' } },
    select: { status: true, total: true, convertedTo: { select: { type: true } } },
  })

  let open = ZERO
  let invoiced = ZERO
  let receipt = ZERO
  let draftTotal = ZERO
  let openCount = 0
  let invoicedCount = 0
  let receiptCount = 0
  let draftCount = 0

  for (const row of rows) {
    const amount = new Decimal(row.total.toString())
    if (row.status === 'DRAFT') {
      draftCount += 1
      draftTotal = draftTotal.plus(amount)
      continue
    }
    if (row.status === 'CLOSED' && row.convertedTo?.type === 'SALES_RECEIPT') {
      receiptCount += 1
      receipt = receipt.plus(amount)
      continue
    }
    if (row.status === 'CLOSED') {
      invoicedCount += 1
      invoiced = invoiced.plus(amount)
      continue
    }
    if (row.status === 'OPEN') {
      openCount += 1
      open = open.plus(amount)
    }
  }

  return {
    open: toMoneyString(open, 2),
    openCount,
    invoiced: toMoneyString(invoiced, 2),
    invoicedCount,
    receipt: toMoneyString(receipt, 2),
    receiptCount,
    draftTotal: toMoneyString(draftTotal, 2),
    draftCount,
  }
}

/** Figures for the sales-receipt home. Each total includes the shorter periods inside it. */
export async function receiptHome(ctx: OrgContext) {
  const now = today(ctx.organization.timeZone)
  const year = now.slice(0, 4)
  const base = {
    orgId: ctx.orgId,
    type: 'SALES_RECEIPT' as const,
    deletedAt: null,
    status: { not: 'VOID' as const },
  }
  const between = (from: CalendarDate, to: CalendarDate) => ({
    ...base,
    date: { gte: toDate(from), lte: toDate(to) },
  })
  const tally = (where: Prisma.SalesDocumentWhereInput) =>
    Promise.all([
      db.salesDocument.aggregate({ where, _sum: { total: true } }),
      db.salesDocument.count({ where }),
    ])

  const [todayRow, monthRow, yearRow, allRow] = await Promise.all([
    tally(between(now, now)),
    tally(between(startOfMonth(now), endOfMonth(now))),
    tally(between(`${year}-01-01`, `${year}-12-31`)),
    tally(base),
  ])

  const figure = (row: [(typeof todayRow)[0], number]) => ({
    total: toMoneyString(row[0]._sum.total ?? 0, 2),
    count: row[1],
  })
  const todayFigure = figure(todayRow)
  const monthFigure = figure(monthRow)
  const yearFigure = figure(yearRow)
  const allFigure = figure(allRow)

  return {
    todayTotal: todayFigure.total,
    todayCount: todayFigure.count,
    monthTotal: monthFigure.total,
    monthCount: monthFigure.count,
    yearTotal: yearFigure.total,
    yearCount: yearFigure.count,
    allTotal: allFigure.total,
    allCount: allFigure.count,
  }
}

/** Names for the customer filter on a sales list. */
export async function customerChoices(ctx: OrgContext) {
  return db.customer.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
  })
}

/** The document before and after this one, in date then number order. A new form sits after the last. */
export async function neighbors(ctx: OrgContext, type: SalesDocumentType, currentId: string | null) {
  const rows = await db.salesDocument.findMany({
    where: { orgId: ctx.orgId, type, deletedAt: null },
    select: { id: true, number: true },
    orderBy: [{ date: 'asc' }, { number: 'asc' }],
  })
  const index = currentId == null ? rows.length : rows.findIndex((row) => row.id === currentId)
  const place = index < 0 ? rows.length : index
  return {
    previous: place > 0 ? rows[place - 1]! : null,
    next: place < rows.length - 1 ? rows[place + 1]! : null,
  }
}

/** Receipts matching a number, a date, an amount, or the latest ones when nothing is typed. */
export async function findReceipts(
  ctx: OrgContext,
  input: { number?: string; date?: string; amount?: string },
) {
  const number = input.number?.trim()
  const date = input.date?.trim()
  const amount = input.amount?.trim()
  const money = amount ? parseMoneyInput(amount) : null
  const where: Prisma.SalesDocumentWhereInput = {
    orgId: ctx.orgId,
    type: 'SALES_RECEIPT',
    deletedAt: null,
    ...(number ? { number: { contains: number, mode: 'insensitive' } } : {}),
    ...(date && isCalendarDate(date) ? { date: toDate(date) } : {}),
    ...(money
      ? {
          total: {
            gte: money.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
            lt: money.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).plus('0.005'),
          },
        }
      : {}),
  }

  const rows = await db.salesDocument.findMany({
    where,
    select: {
      id: true,
      number: true,
      date: true,
      total: true,
      currencyCode: true,
      customer: { select: { displayName: true } },
    },
    orderBy: [{ date: 'desc' }, { number: 'desc' }],
    take: 20,
  })

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    date: toCalendarDate(row.date),
    total: row.total.toString(),
    currencyCode: row.currencyCode,
    customerName: row.customer.displayName,
  }))
}

const DETAIL_SELECT = {
  ...DOCUMENT_SELECT,
  lines: {
    orderBy: { lineNumber: 'asc' },
    select: {
      id: true, lineNumber: true, description: true, quantity: true, unitPrice: true,
      discountPercent: true, amount: true, taxAmount: true, serviceDate: true, storeId: true,
      item: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
      taxCode: { select: { id: true, name: true } },
      incomeAccount: { select: { id: true, code: true, name: true } },
    },
  },
  applications: {
    select: {
      id: true, amount: true, appliedAt: true,
      payment: { select: { id: true, number: true, date: true } },
      creditDocument: { select: { id: true, number: true, date: true } },
    },
  },
  journal: { select: { id: true, journalNumber: true, status: true } },
} satisfies Prisma.SalesDocumentSelect

type DetailRow = Prisma.SalesDocumentGetPayload<{ select: typeof DETAIL_SELECT }>

function toDetail(document: DetailRow) {
  const applied = document.applications.reduce(
    (sum, application) => sum.plus(application.amount.toString()),
    ZERO,
  )
  const total = new Decimal(document.total.toString())

  return {
    ...serialise(document),
    lines: document.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent?.toString() ?? null,
      amount: line.amount.toString(),
      taxAmount: line.taxAmount.toString(),
    })),
    applications: document.applications.map((application) => ({
      ...application,
      amount: application.amount.toString(),
    })),
    journal: document.journal,
    amountApplied: toMoneyString(applied, 2),
    balance: toMoneyString(total.minus(applied), 2),
  }
}

export async function get(ctx: OrgContext, id: string) {
  const document = await db.salesDocument.findFirst({
    where: { id, orgId: ctx.orgId },
    select: DETAIL_SELECT,
  })

  if (!document) throw notFound('Document')

  const [detail] = await attachCreators([toDetail(document)])
  return detail
}

/** The user who wrote the document, printed as Sales person. */
async function attachCreators(rows: ReturnType<typeof toDetail>[]) {
  const ids = [...new Set(rows.map((row) => row.createdById).filter((id): id is string => Boolean(id)))]
  const users =
    ids.length === 0
      ? []
      : await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  const names = new Map(users.map((user) => [user.id, user.name]))
  return rows.map((row) => ({
    ...row,
    createdByName: row.createdById ? (names.get(row.createdById) ?? null) : null,
  }))
}

export type SalesDocumentDetail = Awaited<ReturnType<typeof attachCreators>>[number]

/**
 * Several documents in full, for papers that print many at once (a customer's
 * invoices, invoice by invoice). One query rather than one per document; the
 * result follows the order of `ids`, and ids that are not this organisation's
 * are simply absent.
 */
export async function getMany(ctx: OrgContext, ids: string[]): Promise<SalesDocumentDetail[]> {
  if (ids.length === 0) return []
  const rows = await db.salesDocument.findMany({
    where: { id: { in: ids }, orgId: ctx.orgId },
    select: DETAIL_SELECT,
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered = ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [toDetail(row)] : []
  })
  return attachCreators(ordered)
}

/**
 * What is still owed on each of these invoices.
 *
 * Always derived — `total - sum(applications)` — never stored. That is what lets
 * partial payments, one payment across many invoices, credits used as payment and
 * unapplied cash all work without being special cases, and it is why the aging
 * report cannot disagree with the receivables control account.
 */
export async function outstandingBalances(
  client: Tx | typeof db,
  documentIds: string[],
): Promise<Map<string, Decimal>> {
  if (documentIds.length === 0) return new Map()

  const rows = await client.$queryRaw<{ id: string; total: string; applied: string }[]>`
    SELECT d.id,
           d.total AS total,
           COALESCE((SELECT SUM(a.amount) FROM sales_applications a WHERE a."invoiceId" = d.id), 0) AS applied
      FROM sales_documents d
     WHERE d.id = ANY(${documentIds})
  `

  return new Map(rows.map((row) => [row.id, new Decimal(row.total).minus(row.applied)]))
}

/** Price lines without writing — used by the till before payment. */
export async function quoteLines(ctx: OrgContext, lines: SalesDocumentInput['lines']) {
  return db.$transaction(async (tx) => {
    const resolved = await resolveLines(tx, ctx, lines)
    const taxCodes = await loadTaxCodes(tx, ctx, resolved)
    return priceDocument(resolved, taxCodes, ctx.organization.baseCurrency, null)
  })
}

/* --- Writing -------------------------------------------------------------- */

/**
 * Create a document. Drafts are not posted; anything else is posted immediately.
 *
 * Posting and creating happen in one transaction so a document without its
 * journal, or a journal without its document, is unreachable.
 */
export async function create(
  ctx: OrgContext,
  type: SalesDocumentType,
  input: SalesDocumentInput,
  options?: { pos?: PosCheckoutMeta },
) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const customer = await requireCustomer(tx, ctx, input.customerId)
    const lines = await resolveLines(tx, ctx, input.lines)
    const taxCodes = await loadTaxCodes(tx, ctx, lines)
    const priced = priceDocument(lines, taxCodes, ctx.organization.baseCurrency, documentDiscount(input))

    const isDraft = input.saveAsDraft === true
    const hasPaymentItem = lines.some((line) => line.isPayment)
    assertPostedSaleLines(type, isDraft, lines)
    if (priced.total.isNegative()) {
      throw validation('Payment and discount lines cannot exceed the sale.')
    }
    if (
      priced.total.isZero() &&
      !isDraft &&
      !hasPaymentItem &&
      type !== 'ESTIMATE' &&
      type !== 'QUOTATION' &&
      type !== 'SALES_ORDER'
    ) {
      throw validation('A document with no value has nothing to record.')
    }

    const term = input.paymentTermId
      ? await tx.paymentTerm.findFirst({
          where: { id: input.paymentTermId, orgId: ctx.orgId },
          select: { id: true, type: true, dueDays: true },
        })
      : customer.paymentTerm

    const number = await assignDocumentNumber(tx, ctx.orgId, SEQUENCE_FOR[type], input.number)
    const clash = await tx.salesDocument.findFirst({
      where: { orgId: ctx.orgId, type, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const document = await tx.salesDocument.create({
      data: {
        orgId: ctx.orgId,
        type,
        number,
        customerId: customer.id,
        date: toDate(input.date),
        dueDate:
          type === 'INVOICE' ? toDate(dueDateFor(input.date, term ?? null)) : null,
        expiryDate:
          (type === 'ESTIMATE' || type === 'QUOTATION') && input.expiryDate
            ? toDate(input.expiryDate)
            : null,
        paymentTermId: term?.id ?? null,
        status: isDraft ? 'DRAFT' : 'OPEN',
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        customerMessage: input.customerMessage ?? null,
        subtotal: priced.subtotal.toFixed(4),
        discountAmount: priced.discountAmount.toFixed(4),
        taxTotal: priced.taxTotal.toFixed(4),
        total: priced.total.toFixed(4),
        currencyCode: ctx.organization.baseCurrency,
        depositAccountId: input.depositAccountId ?? null,
        createdById: ctx.userId,
        lines: {
          create: priced.lines.map((line) => ({
            orgId: ctx.orgId,
            lineNumber: line.lineNumber,
            itemId: line.source.itemId ?? null,
            storeId: line.source.storeId ?? null,
            description: line.source.description ?? null,
            quantity: line.quantity.toFixed(4),
            unitPrice: line.unitPrice.toFixed(4),
            discountPercent: line.source.discountPercent
              ? new Decimal(line.source.discountPercent).toFixed(4)
              : null,
            amount: line.amount.toFixed(4),
            taxCodeId: line.taxCodeId,
            taxAmount: line.taxAmount.toFixed(4),
            incomeAccountId: line.incomeAccountId,
            serviceDate: line.source.serviceDate ? toDate(line.source.serviceDate) : null,
          })),
        },
      },
      select: { id: true, number: true, type: true, total: true, status: true },
    })

    if (options?.pos) {
      await tx.posOrder.create({
        data: {
          orgId: ctx.orgId,
          registerId: options.pos.registerId,
          sessionId: options.pos.sessionId,
          salesDocumentId: document.id,
          changeAmount: options.pos.change?.amount ?? '0',
          changePaymentMethodId: options.pos.change?.paymentMethodId ?? null,
          changeLedgerAccountId: options.pos.change?.ledgerAccountId ?? null,
          depositLedgerAccountId: options.pos.depositLedgerAccountId ?? null,
          payments: {
            create: options.pos.payments.map((payment) => ({
              paymentMethodId: payment.paymentMethodId,
              ledgerAccountId: payment.ledgerAccountId,
              amount: payment.amount,
            })),
          },
        },
      })
    }

    if (!isDraft && POSTS_A_JOURNAL[type]) {
      await postDocument(tx, ctx, document.id)
    }

    if (input.convertedFromId) {
      await closeConvertedSource(tx, ctx, {
        sourceId: input.convertedFromId,
        createdId: document.id,
        createdNumber: document.number,
        createdType: type,
      })
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'SalesDocument',
        entityId: document.id,
        action: 'CREATE',
        after: { type, number: document.number, total: document.total.toString(), status: document.status },
      },
      meta,
    )

    return { id: document.id, number: document.number, total: document.total.toString() }
  })
}

/** Link a new invoice/receipt to the proposal or order it came from, and close that source. */
async function closeConvertedSource(
  tx: Tx,
  ctx: OrgContext,
  input: {
    sourceId: string
    createdId: string
    createdNumber: string
    createdType: SalesDocumentType
  },
) {
  const source = await tx.salesDocument.findFirst({
    where: {
      id: input.sourceId,
      orgId: ctx.orgId,
      type: { in: CONVERTIBLE_SOURCES },
    },
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      customerId: true,
      convertedTo: { select: { number: true } },
    },
  })
  if (!source) throw notFound('Document')
  if (source.convertedTo) {
    throw conflict(`${source.number} has already become ${source.convertedTo.number}.`)
  }
  if (source.status === 'VOID' || source.status === 'DECLINED' || source.status === 'CLOSED') {
    throw precondition(`${source.number} is ${source.status.toLowerCase()} and cannot be converted.`)
  }
  if (input.createdType === 'SALES_ORDER' && source.type === 'SALES_ORDER') {
    throw precondition('A sales order cannot become another sales order.')
  }

  await tx.salesDocument.update({
    where: { id: input.createdId },
    data: { convertedFromId: source.id },
  })
  await tx.salesDocument.update({
    where: { id: source.id },
    data: { status: 'CLOSED' },
  })
}

/**
 * Edit a posted document.
 *
 * The document is mutable; its journal is not. So an edit reverses the existing
 * journal and posts a new one, leaving both on the record — see ADR-0002. The
 * net ledger effect equals the new document, and every intermediate state stays
 * inspectable.
 */
export async function update(ctx: OrgContext, id: string, input: SalesDocumentInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const existing = await tx.salesDocument.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, type: true, number: true, status: true, journalId: true, version: true, total: true },
    })
    if (!existing) throw notFound('Document')

    if (existing.status === 'VOID') {
      throw precondition('A voided document cannot be edited. Create a new one.')
    }
    if (existing.status === 'CLOSED') {
      throw precondition(
        `${existing.number} has already been fulfilled. Change the invoice or sales receipt it became.`,
      )
    }

    const applied = await appliedTotal(tx, id)
    if (!applied.isZero()) {
      throw precondition(
        `${existing.number} has ${toMoneyString(applied, 2)} applied to it. ` +
          `Remove the payments or credits before changing what it says.`,
      )
    }

    const customer = await requireCustomer(tx, ctx, input.customerId)
    const lines = await resolveLines(tx, ctx, input.lines)
    const taxCodes = await loadTaxCodes(tx, ctx, lines)
    const priced = priceDocument(lines, taxCodes, ctx.organization.baseCurrency, documentDiscount(input))

    const isDraft = input.saveAsDraft === true
    const hasPaymentItem = lines.some((line) => line.isPayment)
    assertPostedSaleLines(existing.type, isDraft, lines)
    if (priced.total.isNegative()) {
      throw validation('Payment and discount lines cannot exceed the sale.')
    }
    if (
      priced.total.isZero() &&
      !isDraft &&
      !hasPaymentItem &&
      existing.type !== 'ESTIMATE' &&
      existing.type !== 'QUOTATION' &&
      existing.type !== 'SALES_ORDER'
    ) {
      throw validation('A document with no value has nothing to record.')
    }

    const term = input.paymentTermId
      ? await tx.paymentTerm.findFirst({
          where: { id: input.paymentTermId, orgId: ctx.orgId },
          select: { id: true, type: true, dueDays: true },
        })
      : customer.paymentTerm

    // The old journal comes out before the new one goes in — and so does the
    // stock it moved. Reversing only the journal would leave the stock ledger
    // holding goods the general ledger no longer values, and every edit would
    // add another copy of the movement on top.
    if (existing.journalId) {
      const reversal = await reverseJournal(tx, ctx, existing.journalId, {
        reason: `${existing.number} edited`,
      })
      await reverseMovementsFor(tx, ctx, { sourceId: id, date: input.date, journalId: reversal.id })
    }

    await tx.salesDocumentLine.deleteMany({ where: { documentId: id } })

    const number = await assignDocumentNumber(
      tx,
      ctx.orgId,
      SEQUENCE_FOR[existing.type],
      input.number ?? existing.number,
    )
    const clash = await tx.salesDocument.findFirst({
      where: { orgId: ctx.orgId, type: existing.type, number, id: { not: id } },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    await tx.salesDocument.update({
      where: { id },
      data: {
        number,
        customerId: customer.id,
        date: toDate(input.date),
        dueDate: existing.type === 'INVOICE' ? toDate(dueDateFor(input.date, term ?? null)) : null,
        expiryDate:
          (existing.type === 'ESTIMATE' || existing.type === 'QUOTATION') && input.expiryDate
            ? toDate(input.expiryDate)
            : null,
        paymentTermId: term?.id ?? null,
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        customerMessage: input.customerMessage ?? null,
        subtotal: priced.subtotal.toFixed(4),
        discountAmount: priced.discountAmount.toFixed(4),
        taxTotal: priced.taxTotal.toFixed(4),
        total: priced.total.toFixed(4),
        depositAccountId: input.depositAccountId ?? null,
        journalId: null,
        version: { increment: 1 },
        status: input.saveAsDraft ? 'DRAFT' : 'OPEN',
        lines: {
          create: priced.lines.map((line) => ({
            orgId: ctx.orgId,
            lineNumber: line.lineNumber,
            itemId: line.source.itemId ?? null,
            storeId: line.source.storeId ?? null,
            description: line.source.description ?? null,
            quantity: line.quantity.toFixed(4),
            unitPrice: line.unitPrice.toFixed(4),
            discountPercent: line.source.discountPercent
              ? new Decimal(line.source.discountPercent).toFixed(4)
              : null,
            amount: line.amount.toFixed(4),
            taxCodeId: line.taxCodeId,
            taxAmount: line.taxAmount.toFixed(4),
            incomeAccountId: line.incomeAccountId,
            serviceDate: line.source.serviceDate ? toDate(line.source.serviceDate) : null,
          })),
        },
      },
    })

    if (!input.saveAsDraft && POSTS_A_JOURNAL[existing.type]) {
      await postDocument(tx, ctx, id)
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'SalesDocument',
        entityId: id,
        action: 'UPDATE',
        before: { total: existing.total.toString(), version: existing.version },
        after: { total: priced.total.toString(), version: existing.version + 1 },
      },
      meta,
    )

    return { id, number: existing.number }
  })
}

/**
 * Record (or replace) a customer payment promise on an open invoice.
 * The promised date drives overdue lists; the invoice due date is unchanged.
 */
export async function setPaymentPromise(
  ctx: OrgContext,
  id: string,
  promisedDate: CalendarDate,
  note?: string | null,
) {
  if (!isCalendarDate(promisedDate)) {
    throw validation('Choose a valid promise date.', { promisedDate: ['Invalid date'] })
  }
  const invoice = await db.salesDocument.findFirst({
    where: { id, orgId: ctx.orgId, type: 'INVOICE', deletedAt: null },
    select: {
      id: true,
      number: true,
      status: true,
      promisedDate: true,
      promiseNote: true,
      excludeFromOverdue: true,
    },
  })
  if (!invoice) throw notFound('Invoice')
  if (invoice.status !== 'OPEN' && invoice.status !== 'PARTIAL') {
    throw precondition('Only an unpaid invoice can take a payment promise.')
  }

  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const updated = await tx.salesDocument.update({
      where: { id },
      data: {
        promisedDate: toDate(promisedDate),
        promiseNote: note?.trim() || null,
        // A new promise puts the invoice back into collections until that date.
        excludeFromOverdue: false,
      },
      select: { id: true, number: true, promisedDate: true, promiseNote: true },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'SalesDocument',
        entityId: id,
        action: 'UPDATE',
        before: {
          promisedDate: invoice.promisedDate ? toCalendarDate(invoice.promisedDate) : null,
          promiseNote: invoice.promiseNote,
          excludeFromOverdue: invoice.excludeFromOverdue,
        },
        after: {
          promisedDate,
          promiseNote: note?.trim() || null,
          excludeFromOverdue: false,
        },
      },
      meta,
    )
    return updated
  })
}

/**
 * “Un overdue” — keep the invoice open but drop it from overdue / collections lists.
 * Passing false restores it to normal overdue rules.
 */
export async function setExcludeFromOverdue(ctx: OrgContext, id: string, exclude: boolean) {
  const invoice = await db.salesDocument.findFirst({
    where: { id, orgId: ctx.orgId, type: 'INVOICE', deletedAt: null },
    select: { id: true, number: true, status: true, excludeFromOverdue: true },
  })
  if (!invoice) throw notFound('Invoice')
  if (invoice.status !== 'OPEN' && invoice.status !== 'PARTIAL') {
    throw precondition('Only an unpaid invoice can leave the overdue list.')
  }

  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const updated = await tx.salesDocument.update({
      where: { id },
      data: { excludeFromOverdue: exclude },
      select: { id: true, number: true, excludeFromOverdue: true },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'SalesDocument',
        entityId: id,
        action: 'UPDATE',
        before: { excludeFromOverdue: invoice.excludeFromOverdue },
        after: { excludeFromOverdue: exclude },
      },
      meta,
    )
    return updated
  })
}

/** Post a draft, or re-post after an edit. */
export async function postDocument(tx: Tx, ctx: OrgContext, id: string) {
  const document = await tx.salesDocument.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true, type: true, number: true, date: true, memo: true, customerId: true,
      depositAccountId: true, journalId: true, discountAmount: true,
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true, amount: true, taxAmount: true, taxCodeId: true, incomeAccountId: true,
          description: true, quantity: true, unitPrice: true, discountPercent: true, itemId: true, storeId: true,
          item: {
            select: {
              id: true,
              name: true,
              type: true,
              inventoryAccountId: true,
              cogsAccountId: true,
              depositAccountId: true,
            },
          },
        },
      },
    },
  })
  if (!document) throw notFound('Document')
  if (!POSTS_A_JOURNAL[document.type]) return null
  if (document.journalId) throw conflict(`${document.number} is already posted.`)

  for (const [index, line] of document.lines.entries()) {
    if (!line.itemId) {
      throw validation(
        'Every posted sales line must use a product or service from the item list. A name typed by hand is not a registered sale.',
        { lines: [`Line ${index + 1}: choose an item from Products and services`] },
      )
    }
    if (line.item?.type === 'GROUP') {
      throw validation(
        `"${line.item.name}" is a group — pick it on the form so its members are added as lines.`,
        { lines: ['Expand the group into its items'] },
      )
    }
  }

  const taxCodes = await loadTaxCodes(
    tx,
    ctx,
    document.lines.map((line): { taxCodeId: string | null } => ({ taxCodeId: line.taxCodeId })),
  )

  const storedDiscount = new Decimal(document.discountAmount.toString())
  const priced = priceDocument(
    document.lines.map((line) => {
      const type = line.item?.type
      const isDiscount = type === 'DISCOUNT'
      const isSubtotal = type === 'SUBTOTAL'
      const isPayment = type === 'PAYMENT'
      return {
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        discountPercent: line.discountPercent?.toString() ?? null,
        taxCodeId: line.taxCodeId,
        incomeAccountId: isPayment || isSubtotal ? null : line.incomeAccountId,
        depositAccountId: isPayment ? (line.item?.depositAccountId ?? null) : null,
        isDiscount,
        isSubtotal,
        isPayment,
        isStock: type === 'INVENTORY' || type === 'INVENTORY_ASSEMBLY',
      }
    }),
    taxCodes,
    ctx.organization.baseCurrency,
    storedDiscount.greaterThan(0) ? { kind: 'amount', value: storedDiscount.toString() } : null,
  )

  const hasPaymentItem = priced.lines.some((line) => line.source.isPayment)
  const input: SalesJournalInput = {
    date: toCalendarDate(document.date),
    number: document.number,
    documentId: document.id,
    customerId: document.customerId,
    priced,
    receivableAccountId: await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_RECEIVABLE'),
    depositAccountId: document.depositAccountId,
    fallbackIncomeAccountId: await systemAccountId(tx, ctx.orgId, 'UNCATEGORISED_INCOME'),
    discountAccountId: priced.discountAmount.isZero() ? null : await salesDiscountAccountId(tx, ctx.orgId),
    paymentDepositAccountId: hasPaymentItem
      ? await systemAccountId(tx, ctx.orgId, 'UNDEPOSITED_FUNDS')
      : null,
    memo: document.memo,
  }

  const posOrder = await tx.posOrder.findUnique({
    where: { salesDocumentId: id },
    select: {
      changeAmount: true,
      changeLedgerAccountId: true,
      depositLedgerAccountId: true,
      changePaymentMethod: { select: { name: true } },
      payments: {
        select: {
          ledgerAccountId: true,
          amount: true,
          paymentMethod: { select: { name: true } },
        },
      },
    },
  })
  if (posOrder?.payments.length) {
    const change = new Decimal(posOrder.changeAmount.toString())
    const posted = posPostedAccounts({
      depositLedgerAccountId: posOrder.depositLedgerAccountId,
      payments: posOrder.payments.map((payment) => ({
        accountId: payment.ledgerAccountId,
        amount: new Decimal(payment.amount.toString()),
        description: payment.paymentMethod.name,
        isCash: isCashMethodName(payment.paymentMethod.name),
      })),
      change:
        change.gt(0) && posOrder.changeLedgerAccountId
          ? {
              accountId: posOrder.changeLedgerAccountId,
              amount: change,
              description: posOrder.changePaymentMethod
                ? `Change · ${posOrder.changePaymentMethod.name}`
                : 'Change',
              isCash: posOrder.changePaymentMethod
                ? isCashMethodName(posOrder.changePaymentMethod.name)
                : true,
            }
          : null,
    })
    input.paymentSplits = posted.payments
    if (posted.change) input.changeReturns = [posted.change]
    if (posOrder.depositLedgerAccountId) {
      input.depositAccountId = posOrder.depositLedgerAccountId
    }
  }

  // Tracked stock moves as part of posting, and its cost joins the same journal.
  // A sale and its cost are one event; two entries would let a report run between
  // them and show a margin that was never real.
  const movesStockOut = document.type === 'INVOICE' || document.type === 'SALES_RECEIPT'
  const movesStockIn = document.type === 'CREDIT_MEMO'

  if (movesStockOut || movesStockIn) {
    // Every product sale uses the system Cost of Goods Sold account, at the
    // stock ledger's own cost. A per-item expense account would bury the margin
    // in operating expenses.
    const systemCogsAccountId = await systemAccountId(tx, ctx.orgId, 'COGS')
    const cogs = new Map<string, { cogsAccountId: string; inventoryAccountId: string; amount: Decimal }>()
    const storeAccounts = await storeService.accountsFor(
      tx,
      ctx.orgId,
      document.lines.map((line) => line.storeId),
    )
    const saleMovements: {
      lineId: string
      itemId: string
      storeId: string | null
      quantity: Decimal
      unitCost: Decimal
      value: Decimal
    }[] = []

    // Assemblies must be built before they are sold. Selling an unbuilt unit
    // would issue stock at $0 cost and leave the bill of materials untouched.
    if (movesStockOut) {
      const assemblyNeed = new Map<string, { name: string; needed: Decimal }>()
      for (const line of document.lines) {
        if (line.item?.type !== 'INVENTORY_ASSEMBLY') continue
        const needed = new Decimal(line.quantity.toString())
        const prior = assemblyNeed.get(line.item.id)
        if (prior) prior.needed = prior.needed.plus(needed)
        else assemblyNeed.set(line.item.id, { name: line.item.name, needed })
      }
      for (const [itemId, row] of assemblyNeed) {
        const onHand = (await positionOf(tx, itemId)).quantity
        if (row.needed.greaterThan(onHand)) {
          throw precondition(
            `There ${onHand.equals(1) ? 'is' : 'are'} ${onHand.toFixed(2)} of "${row.name}" built and ready to sell, ` +
              `and this sale needs ${row.needed.toFixed(2)}. ` +
              `Assemblies are finished goods: build them first (Inventory → Build assemblies) so materials leave stock and COGS has a cost, then sell.`,
          )
        }
      }
    }

    for (const line of document.lines) {
      if (line.item?.type !== 'INVENTORY' && line.item?.type !== 'INVENTORY_ASSEMBLY') continue
      if (!line.item.inventoryAccountId) {
        throw precondition(`"${line.item.name}" has no inventory account.`)
      }

      const inventoryAccountId =
        (line.storeId && storeAccounts.get(line.storeId)) || line.item.inventoryAccountId
      const quantity = new Decimal(line.quantity.toString())
      const movement = await recordMovement(tx, ctx, {
        itemId: line.item.id,
        date: toCalendarDate(document.date),
        type: movesStockOut ? 'SALE' : 'SALE_RETURN',
        sourceType: document.type as never,
        sourceId: document.id,
        sourceLineId: line.id,
        quantity: movesStockOut ? quantity.negated() : quantity,
        storeId: line.storeId,
      })

      if (movesStockOut) {
        saleMovements.push({
          lineId: line.id,
          itemId: line.item.id,
          storeId: line.storeId,
          quantity,
          unitCost: movement.unitCost,
          value: movement.value,
        })
      }

      const key = `${systemCogsAccountId}|${inventoryAccountId}`
      const existing = cogs.get(key)
      const amount = movement.value.abs()
      if (existing) existing.amount = existing.amount.plus(amount)
      else
        cogs.set(key, {
          cogsAccountId: systemCogsAccountId,
          inventoryAccountId,
          amount,
        })
    }

    input.cogs = [...cogs.values()]

    if (movesStockOut) {
      await salesDelivery.syncFromSale(tx, ctx, document.id, saleMovements)
    }
  }

  const draft =
    document.type === 'INVOICE'
      ? buildInvoiceJournal(input)
      : document.type === 'SALES_RECEIPT'
        ? buildSalesReceiptJournal(input)
        : document.type === 'CREDIT_MEMO'
          ? buildCreditMemoJournal(input)
          : buildRefundReceiptJournal(input)

  const journal = await postJournal(tx, ctx, draft)

  // Tie the movements to the journal they were posted with.
  await tx.inventoryTransaction.updateMany({
    where: { orgId: ctx.orgId, sourceId: document.id, journalId: null },
    data: { journalId: journal.id },
  })

  await tx.salesDocument.update({
    where: { id },
    data: { journalId: journal.id, status: 'OPEN' },
  })

  await refreshStatus(tx, id)
  return journal
}

/**
 * Delete a sales document.
 *
 * One verb, whatever state the document is in. A draft is withdrawn; a posted
 * invoice is withdrawn along with the journal it posted and the stock it moved.
 * Nothing is offered instead of deleting, and nothing has to be undone first:
 * payments and credits applied to it are released back to their payment, which is
 * then simply unapplied money sitting on the customer's account — which is what
 * it now is.
 *
 * Nothing is physically removed. See `server/accounting/deletion.ts` for why
 * that is compatible with the figure disappearing from every report.
 */
export async function remove(ctx: OrgContext, id: string, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const document = await tx.salesDocument.findFirst({
      // `deletedAt: undefined` opts out of the client's soft-delete filter, so a
      // second Delete on the same row is a no-op rather than a "not found".
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        id: true, type: true, number: true, status: true, journalId: true, total: true,
        deletedAt: true,
        applications: { select: { id: true, paymentId: true, invoiceId: true } },
        creditsApplied: { select: { id: true, paymentId: true, invoiceId: true } },
      },
    })
    if (!document) throw notFound('Document')
    if (document.deletedAt) return { id, number: document.number }

    // Applications are the only rows that genuinely have to go: they are a link
    // between two documents, and a link to something withdrawn is not history,
    // it is a dangling reference. Removing them restores the payment's unapplied
    // balance, which is the correct state once the invoice is gone.
    const applications = [...document.applications, ...document.creditsApplied]
    const touchedInvoiceIds = [
      ...new Set(applications.map((application) => application.invoiceId).filter((v) => v !== id)),
    ]

    if (applications.length > 0) {
      await tx.salesApplication.deleteMany({
        where: { id: { in: applications.map((application) => application.id) } },
      })
    }

    // An estimate this became, or that became this, loses its link for the same
    // reason: it points at something that is no longer there.
    await tx.salesDocument.updateMany({
      where: { orgId: ctx.orgId, convertedFromId: id },
      data: { convertedFromId: null },
    })

    // The goods come back. Stock positions are running totals, so a movement is
    // undone by appending its opposite rather than by hiding the original row —
    // and both sides fall by the same amount, because withdrawing the journal
    // takes the inventory value out of the general ledger at the same time.
    await reverseMovementsFor(tx, ctx, { sourceId: id })

    await salesDelivery.voidForSale(
      tx,
      ctx,
      id,
      reason?.trim() || `${document.number} deleted`,
    )

    await softDeleteDocument(tx, ctx, {
      mark: (stamp) => tx.salesDocument.update({ where: { id }, data: stamp }),
      entity: 'SalesDocument',
      id,
      number: document.number,
      journalIds: [document.journalId],
      reason,
      before: {
        type: document.type,
        status: document.status,
        total: document.total.toString(),
        applicationsReleased: applications.length,
      },
    })

    // Whatever those applications were settling is outstanding again.
    for (const invoiceId of touchedInvoiceIds) {
      await refreshStatus(tx, invoiceId)
    }

    return { id, number: document.number }
  })
}

/**
 * Put a deleted sales document back into the working books.
 *
 * Applications released on delete are not rebuilt — the document returns unpaid
 * (or unapplied), and payments stay unapplied for the user to link again.
 */
export async function restore(ctx: OrgContext, id: string) {
  return db.$transaction(async (tx) => {
    const document = await tx.salesDocument.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        id: true,
        type: true,
        number: true,
        journalId: true,
        deletedAt: true,
      },
    })
    if (!document) throw notFound('Document')
    if (!document.deletedAt) {
      return { id, number: document.number, href: salesHref(document.type, document.id) }
    }

    if (document.journalId) {
      await restoreMovementsFor(tx, ctx, { sourceId: id, journalId: document.journalId })
    }
    await salesDelivery.restoreForSale(tx, ctx, id)

    await restoreSoftDeletedDocument(tx, ctx, {
      clear: () => tx.salesDocument.update({ where: { id }, data: CLEAR_DELETION }),
      entity: 'SalesDocument',
      id,
      number: document.number,
      journalIds: [document.journalId],
      before: { type: document.type },
    })

    return { id, number: document.number, href: salesHref(document.type, document.id) }
  })
}

function salesHref(type: SalesDocumentType, id: string) {
  return `/sales/${salesByType(type).slug}/${id}`
}

const CONVERTIBLE_SOURCES: SalesDocumentType[] = ['ESTIMATE', 'QUOTATION', 'SALES_ORDER']
export const CONVERT_TARGETS = ['INVOICE', 'SALES_RECEIPT', 'SALES_ORDER'] as const
export type ConvertTarget = (typeof CONVERT_TARGETS)[number]

/**
 * Open estimates, quotations, and sales orders that can still become a sale —
 * not voided, declined, or already converted. Used on new invoice / sales
 * receipt forms and the till (QuickBooks “Available estimates / orders”).
 */
export async function listConvertibleSources(
  ctx: OrgContext,
  options: { types?: SalesDocumentType[] } = {},
) {
  const types = options.types?.length ? options.types : CONVERTIBLE_SOURCES
  const rows = await db.salesDocument.findMany({
    where: {
      orgId: ctx.orgId,
      type: { in: types },
      status: { notIn: ['VOID', 'DECLINED', 'CLOSED'] },
      convertedTo: { is: null },
    },
    orderBy: [{ date: 'desc' }, { number: 'desc' }],
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      total: true,
      customerId: true,
      customer: { select: { displayName: true } },
      _count: { select: { lines: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    number: row.number,
    date: toCalendarDate(row.date),
    total: row.total.toString(),
    customerId: row.customerId,
    customerName: row.customer.displayName,
    lineCount: row._count.lines,
  }))
}

/** Estimates and quotations only — the till still picks from proposals. */
export async function listConvertibleEstimates(ctx: OrgContext) {
  return listConvertibleSources(ctx, { types: ['ESTIMATE', 'QUOTATION'] })
}

/**
 * One open estimate, quotation, or sales order with its lines — for the
 * QuickBooks-style “pick which items to invoice” dialog.
 */
export async function getConvertibleSource(ctx: OrgContext, id: string) {
  const row = await db.salesDocument.findFirst({
    where: {
      id,
      orgId: ctx.orgId,
      type: { in: CONVERTIBLE_SOURCES },
      status: { notIn: ['VOID', 'DECLINED', 'CLOSED'] },
      convertedTo: { is: null },
    },
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      total: true,
      customerId: true,
      reference: true,
      memo: true,
      customerMessage: true,
      paymentTermId: true,
      discountAmount: true,
      customer: { select: { displayName: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          itemId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          discountPercent: true,
          taxCodeId: true,
          storeId: true,
          amount: true,
          item: { select: { name: true, sku: true } },
        },
      },
    },
  })
  if (!row) throw notFound('Document')

  return {
    id: row.id,
    type: row.type,
    number: row.number,
    date: toCalendarDate(row.date),
    total: row.total.toString(),
    customerId: row.customerId,
    customerName: row.customer.displayName,
    reference: row.reference,
    memo: row.memo,
    customerMessage: row.customerMessage,
    paymentTermId: row.paymentTermId,
    discountAmount: row.discountAmount.toString(),
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      itemName: line.item?.name ?? null,
      itemSku: line.item?.sku ?? null,
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent?.toString() ?? null,
      taxCodeId: line.taxCodeId,
      storeId: line.storeId,
      amount: line.amount.toString(),
    })),
  }
}

/**
 * Turn an estimate, quotation, or sales order into the next paper.
 *
 * Paths match QuickBooks Online + Desktop:
 * - Proposal → invoice (bill later)
 * - Proposal → sales receipt (paid now)
 * - Proposal → sales order (Desktop: accept, fulfill later)
 * - Sales order → invoice or sales receipt (collect)
 *
 * The source is kept and closed so what was sent stays readable.
 */
export async function convertSalesDocument(
  ctx: OrgContext,
  sourceId: string,
  date: CalendarDate,
  target: ConvertTarget,
  depositAccountId?: string | null,
) {
  const meta = await requestMeta()

  if (target === 'SALES_RECEIPT') {
    if (!depositAccountId) {
      throw validation('Choose the account the money was received into.', {
        depositAccountId: ['Choose an account.'],
      })
    }
    const account = await db.ledgerAccount.findFirst({
      where: { id: depositAccountId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!account) {
      throw validation('That account cannot receive this sale.', {
        depositAccountId: ['Choose an account.'],
      })
    }
  }

  return db.$transaction(async (tx) => {
    const source = await tx.salesDocument.findFirst({
      where: { id: sourceId, orgId: ctx.orgId, type: { in: CONVERTIBLE_SOURCES } },
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        customerId: true,
        reference: true,
        memo: true,
        customerMessage: true,
        paymentTermId: true,
        discountAmount: true,
        convertedTo: { select: { number: true, type: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            itemId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            discountPercent: true,
            taxCodeId: true,
            incomeAccountId: true,
            storeId: true,
          },
        },
      },
    })
    if (!source) throw notFound('Document')
    if (source.convertedTo) {
      throw conflict(`${source.number} has already become ${source.convertedTo.number}.`)
    }
    if (source.status === 'VOID' || source.status === 'DECLINED' || source.status === 'CLOSED') {
      throw precondition(
        `${source.number} is ${source.status.toLowerCase()} and cannot be converted.`,
      )
    }
    if (source.type === 'SALES_ORDER' && target === 'SALES_ORDER') {
      throw precondition('A sales order cannot become another sales order.')
    }
    if (source.type === target) {
      throw precondition(`${source.number} is already that kind of document.`)
    }

    const discount = new Decimal(source.discountAmount.toString())
    const created = await create(ctx, target, {
      customerId: source.customerId,
      date,
      reference: source.reference,
      memo: source.memo,
      customerMessage: source.customerMessage,
      paymentTermId: target === 'INVOICE' || target === 'SALES_ORDER' ? source.paymentTermId : null,
      depositAccountId: target === 'SALES_RECEIPT' ? depositAccountId : null,
      discountKind: 'amount',
      discountValue: discount.greaterThan(0) ? discount.toString() : null,
      lines: source.lines.map((line) => ({
        itemId: line.itemId,
        storeId: line.storeId,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        discountPercent: line.discountPercent?.toString() ?? null,
        taxCodeId: line.taxCodeId,
      })),
    } as SalesDocumentInput)

    await tx.salesDocument.update({
      where: { id: created.id },
      data: { convertedFromId: sourceId },
    })
    await tx.salesDocument.update({
      where: { id: sourceId },
      data: { status: 'CLOSED' },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'SalesDocument',
        entityId: sourceId,
        action: 'UPDATE',
        after: { convertedTo: created.number, fulfilledAs: target },
      },
      meta,
    )

    return { ...created, type: target }
  })
}

/** Proposal → invoice. Kept for the till and older call sites. */
export async function convertEstimate(ctx: OrgContext, estimateId: string, date: CalendarDate) {
  return convertSalesDocument(ctx, estimateId, date, 'INVOICE')
}

/** Sales order → invoice or sales receipt. */
export async function convertSalesOrder(
  ctx: OrgContext,
  orderId: string,
  date: CalendarDate,
  target: 'INVOICE' | 'SALES_RECEIPT',
  depositAccountId?: string | null,
) {
  return convertSalesDocument(ctx, orderId, date, target, depositAccountId)
}

/** Recompute OPEN / PARTIAL / PAID from what has actually been applied. */
export async function refreshStatus(tx: Tx, documentId: string) {
  const document = await tx.salesDocument.findUnique({
    where: { id: documentId },
    select: { id: true, type: true, total: true, status: true },
  })
  if (!document) return
  if (document.status === 'VOID' || document.status === 'DRAFT') return
  if (document.type !== 'INVOICE') return

  const applied = await appliedTotal(tx, documentId)
  const total = new Decimal(document.total.toString())

  const status = applied.greaterThanOrEqualTo(total)
    ? 'PAID'
    : applied.greaterThan(0)
      ? 'PARTIAL'
      : 'OPEN'

  if (status !== document.status) {
    await tx.salesDocument.update({ where: { id: documentId }, data: { status } })
  }
}

/* --- Helpers -------------------------------------------------------------- */

async function appliedTotal(tx: Tx, documentId: string): Promise<Decimal> {
  const result = await tx.salesApplication.aggregate({
    where: { invoiceId: documentId },
    _sum: { amount: true },
  })
  return new Decimal(result._sum.amount?.toString() ?? '0')
}

async function requireCustomer(tx: Tx, ctx: OrgContext, customerId: string) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
    select: {
      id: true,
      isActive: true,
      displayName: true,
      paymentTerm: { select: { id: true, type: true, dueDays: true } },
    },
  })
  if (!customer) throw notFound('Customer')
  if (!customer.isActive) {
    throw precondition(`${customer.displayName} is archived. Restore them before invoicing.`)
  }
  return customer
}

/**
 * Posted sales must name a registered item. A free-typed label in the picker
 * that was never chosen is not inventory, not income mapping, and not COGS —
 * accepting it would post Uncategorised Income with no stock movement.
 */
function assertPostedSaleLines(
  type: SalesDocumentType,
  isDraft: boolean,
  lines: DraftSalesLine[],
) {
  if (isDraft) return
  if (
    type !== 'INVOICE' &&
    type !== 'SALES_RECEIPT' &&
    type !== 'CREDIT_MEMO' &&
    type !== 'REFUND_RECEIPT'
  ) {
    return
  }

  for (const [index, line] of lines.entries()) {
    if (line.isSubtotal) continue
    if (line.itemId) continue
    throw validation(
      'Every posted sales line must use a product or service from the item list. A name typed by hand is not a registered sale.',
      { lines: [`Line ${index + 1}: choose an item from Products and services`] },
    )
  }
}

/**
 * Resolve each line against its item: price, description and income account come
 * from master data unless the line overrides them.
 */
async function resolveLines(
  tx: Tx,
  ctx: OrgContext,
  lines: SalesDocumentInput['lines'],
): Promise<DraftSalesLine[]> {
  const itemIds = lines.map((line) => line.itemId).filter(Boolean) as string[]

  const items = itemIds.length
    ? await tx.item.findMany({
        where: { id: { in: itemIds }, orgId: ctx.orgId },
        select: {
          id: true, name: true, type: true, isActive: true, salesPrice: true,
          salesDescription: true, description: true, incomeAccountId: true, salesTaxCodeId: true,
          inventoryAccountId: true, cogsAccountId: true, depositAccountId: true,
        },
      })
    : []

  const byId = new Map(items.map((item) => [item.id, item]))
  const storeIds = [...new Set(lines.map((line) => line.storeId).filter((id): id is string => Boolean(id)))]
  const knownStores = storeIds.length
    ? new Set(
        (
          await tx.store.findMany({
            where: { orgId: ctx.orgId, id: { in: storeIds } },
            select: { id: true },
          })
        ).map((store) => store.id),
      )
    : new Set<string>()

  return lines.map((line): DraftSalesLine => {
    const item = line.itemId ? byId.get(line.itemId) : null
    if (line.itemId && !item) throw notFound('Item')
    if (item && !item.isActive) {
      throw precondition(`"${item.name}" is archived and cannot be sold.`)
    }
    if (item?.type === 'GROUP') {
      throw validation(
        `"${item.name}" is a group — pick it on the form so its members are added as lines.`,
        { lines: ['Expand the group into its items'] },
      )
    }
    if (line.storeId && !knownStores.has(line.storeId)) throw notFound('Store')

    const isDiscount = item?.type === 'DISCOUNT'
    const isSubtotal = item?.type === 'SUBTOTAL'
    const isPayment = item?.type === 'PAYMENT'

    return {
      itemId: line.itemId ?? null,
      storeId: line.storeId ?? null,
      description:
        line.description ?? item?.salesDescription ?? item?.description ?? item?.name ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice !== '' ? line.unitPrice : (item?.salesPrice?.toString() ?? '0'),
      discountPercent: line.discountPercent ?? null,
      taxCodeId: ctx.features.enableTax && !isPayment && !isSubtotal
        ? (line.taxCodeId ?? item?.salesTaxCodeId ?? null)
        : null,
      incomeAccountId: isPayment || isSubtotal ? null : (item?.incomeAccountId ?? null),
      depositAccountId: isPayment ? (item?.depositAccountId ?? null) : null,
      serviceDate: line.serviceDate ?? null,
      isDiscount,
      isSubtotal,
      isPayment,
      isStock: item?.type === 'INVENTORY' || item?.type === 'INVENTORY_ASSEMBLY',
    }
  })
}

async function loadTaxCodes(
  tx: Tx,
  ctx: OrgContext,
  lines: { taxCodeId?: string | null }[],
): Promise<Map<string, TaxCodeShape>> {
  const ids = [...new Set(lines.map((line) => line.taxCodeId).filter(Boolean) as string[])]
  const codes = new Map<string, TaxCodeShape>()

  for (const id of ids) {
    const code = await loadCodeForCalculation(tx, ctx.orgId, id)
    if (!code) throw notFound('Tax code')
    codes.set(id, code)
  }

  return codes
}

function serialise<T extends Record<string, unknown>>(row: T) {
  const out: Record<string, unknown> = { ...row }
  for (const key of ['subtotal', 'discountAmount', 'taxTotal', 'total']) {
    if (out[key] && typeof out[key] === 'object') out[key] = String(out[key])
  }
  return out as T & { subtotal: string; discountAmount: string; taxTotal: string; total: string }
}
