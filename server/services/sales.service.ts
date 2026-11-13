import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { DocumentType, Prisma, SalesDocumentType } from '@prisma/client'

import { endOfMonth, isCalendarDate, startOfMonth, toCalendarDate, toDate, today, type CalendarDate } from '@/lib/date'
import { documentOverdueOr, overdueClock } from '@/lib/invoice-overdue'
import { Decimal, formatMoney, parseMoneyInput, toMoneyString, ZERO } from '@/lib/money'
import { dueDateFor } from '@/lib/payment-terms'
import { isCashMethodName } from '@/lib/pos-payment'
import { posPostedAccounts } from '@/lib/pos-register-posting'
import { byType as salesByType } from '@/lib/sales-types'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { InvoiceFromSourceInput, SalesDocumentInput } from '@/lib/validation/sales'
import {
  resolvePostableCogsAccountId,
  seedChartOfAccounts,
  systemAccountId,
} from '@/server/accounting/chart-of-accounts'
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
import * as approvalService from '@/server/services/approval.service'
import { subledgerBalances } from '@/server/services/contact.service'
import { resolveProjectId } from '@/server/services/project.service'
import { resolveId as resolveTrackingCategoryId } from '@/server/services/tracking-category.service'
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
  /** Tip held for staff (separate POS_TIP journal). */
  tipAmount?: string
  diningTableId?: string | null
  /** Offline queue id — unique per org when set. */
  clientSaleId?: string | null
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
  status: true, reference: true, inRef: true, prescriptionRef: true, memo: true, customerMessage: true, workScope: true, workSite: true,
  subtotal: true, discountAmount: true, taxTotal: true, total: true,
  currencyCode: true, exchangeRate: true, depositAccountId: true, paymentMethod: true, journalId: true, version: true,
  voidedAt: true, voidReason: true, convertedFromId: true, paymentTermId: true,
  projectId: true,
  trackingCategoryId: true,
  createdById: true,
  project: { select: { id: true, number: true, name: true, siteLocation: true } },
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
      balanceDate: true,
      agreementDate: true,
      balanceTime: true,
    },
  },
  paymentTerm: { select: { id: true, name: true, type: true, dueDays: true } },
  depositAccount: { select: { id: true, code: true, name: true } },
  convertedTo: { select: { id: true, number: true, type: true } },
  convertedFrom: { select: { id: true, number: true, type: true } },
} satisfies Prisma.SalesDocumentSelect

/** Register list columns only — keeps /sales/* lists off the fat document select. */
const LIST_DOCUMENT_SELECT = {
  id: true,
  type: true,
  number: true,
  date: true,
  dueDate: true,
  expiryDate: true,
  createdAt: true,
  promisedDate: true,
  excludeFromOverdue: true,
  status: true,
  reference: true,
  total: true,
  createdById: true,
  customer: {
    select: {
      id: true,
      displayName: true,
      balanceDate: true,
      agreementDate: true,
      balanceTime: true,
    },
  },
  depositAccount: { select: { id: true, code: true, name: true } },
  convertedTo: { select: { id: true, number: true, type: true } },
} satisfies Prisma.SalesDocumentSelect

/** Default working-set cap for sales registers (page still filters last3 by default). */
export const SALES_REGISTER_TAKE = 500

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
    ids?: string[]
    sort?: string
    dir?: 'asc' | 'desc'
    from?: CalendarDate
    to?: CalendarDate
    /** Cap rows returned for UI registers without changing total count. */
    takeMax?: number
  } = {},
) {
  const selected = options.ids?.filter(Boolean) ?? []
  const where: Prisma.SalesDocumentWhereInput = {
    orgId: ctx.orgId,
    type,
    ...(selected.length ? { id: { in: selected } } : {}),
    ...(selected.length ? {} : options.customerId ? { customerId: options.customerId } : {}),
    ...(options.status === 'open' ? { status: { in: ['OPEN', 'PARTIAL'] } } : {}),
    ...(options.status === 'overdue'
      ? (() => {
          const clock = overdueClock(ctx.organization.timeZone)
          return {
            status: { in: ['OPEN' as const, 'PARTIAL' as const] },
            excludeFromOverdue: false,
            OR: documentOverdueOr({
              asOf: clock.asOfDate,
              nowTime: clock.nowTime,
              party: 'customer',
              withPromisedDate: true,
            }) as Prisma.SalesDocumentWhereInput[],
          }
        })()
      : {}),
    ...(options.status === 'draft' ? { status: 'DRAFT' } : {}),
    ...(options.status === 'notdue'
      ? (() => {
          const clock = overdueClock(ctx.organization.timeZone)
          return {
            status: { in: ['OPEN' as const, 'PARTIAL' as const] },
            OR: [
              { excludeFromOverdue: true },
              {
                AND: [
                  { excludeFromOverdue: false },
                  {
                    NOT: {
                      OR: documentOverdueOr({
                        asOf: clock.asOfDate,
                        nowTime: clock.nowTime,
                        party: 'customer',
                        withPromisedDate: true,
                      }) as Prisma.SalesDocumentWhereInput[],
                    },
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
        ? { status: 'CLOSED' as const, convertedTo: { some: { type: 'INVOICE' as const } } }
        : { status: 'CLOSED' as const }
      : {}),
    ...(options.status === 'receipt' && type === 'SALES_ORDER'
      ? { status: 'CLOSED' as const, convertedTo: { some: { type: 'SALES_RECEIPT' as const } } }
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

  const pageSlice = paginate(query)
  const take = options.takeMax != null ? Math.min(pageSlice.take, options.takeMax) : pageSlice.take

  const [rows, total] = await Promise.all([
    db.salesDocument.findMany({
      where,
      select: LIST_DOCUMENT_SELECT,
      orderBy:
        (options.sort ? SALES_ORDER[options.sort]?.(options.dir ?? 'asc') : undefined) ??
        [{ date: 'desc' }, { number: 'desc' }],
      skip: pageSlice.skip,
      take,
    }),
    db.salesDocument.count({ where }),
  ])

  const balances = await outstandingBalances(
    db,
    rows.map((row) => row.id),
    ctx.orgId,
  )

  return paged(
    rows.map((row) => ({
      ...serialise(row),
      balance: toMoneyString(balances.get(row.id) ?? new Decimal(row.total.toString()), 2),
      appliedCount: 0,
      truncated: total > take,
    })),
    total,
    { ...query, pageSize: take },
  )
}

/**
 * Figures for the invoice home. Unpaid is what is still owed. Overdue and
 * not-due split that same balance, so they add back to unpaid. Paid is money
 * already settled. Drafts have not been sent.
 */
export function invoiceHome(ctx: OrgContext) {
  const clock = overdueClock(ctx.organization.timeZone)
  return cachedInvoiceHome(ctx.orgId, clock.asOf, clock.nowTime)
}

const cachedInvoiceHome = cache((orgId: string, asOfIso: string, nowTime: string) =>
  unstable_cache(
    () => queryInvoiceHome(orgId, asOfIso, nowTime),
    ['invoice-home-v2', orgId, asOfIso, nowTime],
    { revalidate: 60 },
  )(),
)

async function queryInvoiceHome(orgId: string, asOfIso: string, nowTime: string) {
  const asOf = toDate(asOfIso)
  // One aggregate. Loading every invoice into the app held a connection long
  // enough for the pooler to drop it, and the invoices page then showed a blank error.
  const [row] = await db.$queryRaw<
    {
      unpaid: string
      unpaid_count: number
      overdue: string
      overdue_count: number
      paid: string
      paid_count: number
      draft_total: string
      draft_count: number
    }[]
  >`
    SELECT
      COALESCE(SUM(CASE WHEN d.status IN ('OPEN', 'PARTIAL')
        THEN d.total - COALESCE(a.applied, 0) ELSE 0 END), 0)::text AS unpaid,
      COUNT(*) FILTER (WHERE d.status IN ('OPEN', 'PARTIAL'))::int AS unpaid_count,
      COALESCE(SUM(CASE WHEN d.status IN ('OPEN', 'PARTIAL')
        AND d."excludeFromOverdue" = false
        AND (
          (d."promisedDate" IS NOT NULL AND d."promisedDate" < ${asOf})
          OR (d."promisedDate" IS NULL AND c."balanceDate" IS NOT NULL AND (
               c."balanceDate" < ${asOf}
               OR (c."balanceDate" = ${asOf} AND c."balanceTime" IS NOT NULL AND c."balanceTime" <= ${nowTime})
          ))
          OR (d."promisedDate" IS NULL AND c."balanceDate" IS NULL AND c."agreementDate" IS NOT NULL
              AND c."agreementDate" < ${asOf})
          OR (d."promisedDate" IS NULL AND c."balanceDate" IS NULL AND c."agreementDate" IS NULL
              AND COALESCE(d."dueDate", d.date) < ${asOf})
        )
        THEN d.total - COALESCE(a.applied, 0) ELSE 0 END), 0)::text AS overdue,
      COUNT(*) FILTER (WHERE d.status IN ('OPEN', 'PARTIAL')
        AND d."excludeFromOverdue" = false
        AND (
          (d."promisedDate" IS NOT NULL AND d."promisedDate" < ${asOf})
          OR (d."promisedDate" IS NULL AND c."balanceDate" IS NOT NULL AND (
               c."balanceDate" < ${asOf}
               OR (c."balanceDate" = ${asOf} AND c."balanceTime" IS NOT NULL AND c."balanceTime" <= ${nowTime})
          ))
          OR (d."promisedDate" IS NULL AND c."balanceDate" IS NULL AND c."agreementDate" IS NOT NULL
              AND c."agreementDate" < ${asOf})
          OR (d."promisedDate" IS NULL AND c."balanceDate" IS NULL AND c."agreementDate" IS NULL
              AND COALESCE(d."dueDate", d.date) < ${asOf})
        ))::int AS overdue_count,
      COALESCE(SUM(CASE WHEN d.status = 'PAID' THEN d.total ELSE 0 END), 0)::text AS paid,
      COUNT(*) FILTER (WHERE d.status = 'PAID')::int AS paid_count,
      COALESCE(SUM(CASE WHEN d.status = 'DRAFT' THEN d.total ELSE 0 END), 0)::text AS draft_total,
      COUNT(*) FILTER (WHERE d.status = 'DRAFT')::int AS draft_count
    FROM sales_documents d
    JOIN customers c ON c.id = d."customerId"
    LEFT JOIN (
      SELECT "invoiceId", SUM(amount) AS applied
        FROM sales_applications
       WHERE "orgId" = ${orgId}
       GROUP BY "invoiceId"
    ) a ON a."invoiceId" = d.id
    WHERE d."orgId" = ${orgId}
      AND d.type = 'INVOICE'
      AND d."deletedAt" IS NULL
      AND d.status <> 'VOID'
  `
  const unpaid = new Decimal(row?.unpaid ?? '0')
  const overdue = new Decimal(row?.overdue ?? '0')
  const unpaidCount = Number(row?.unpaid_count ?? 0)
  const overdueCount = Number(row?.overdue_count ?? 0)

  return {
    unpaid: toMoneyString(unpaid, 2),
    unpaidCount,
    overdue: toMoneyString(overdue, 2),
    overdueCount,
    notDue: toMoneyString(unpaid.minus(overdue), 2),
    notDueCount: unpaidCount - overdueCount,
    paid: toMoneyString(new Decimal(row?.paid ?? '0'), 2),
    paidCount: Number(row?.paid_count ?? 0),
    draftTotal: toMoneyString(new Decimal(row?.draft_total ?? '0'), 2),
    draftCount: Number(row?.draft_count ?? 0),
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
    if (row.status === 'CLOSED' && row.convertedTo.some((child) => child.type === 'SALES_RECEIPT')) {
      receiptCount += 1
      receipt = receipt.plus(amount)
      continue
    }
    if (row.status === 'CLOSED') {
      invoicedCount += 1
      invoiced = invoiced.plus(amount)
      continue
    }
    if (row.status === 'OPEN' || row.status === 'PARTIAL') {
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
export function customerChoices(ctx: OrgContext) {
  return cachedCustomerChoices(ctx.orgId)
}

const cachedCustomerChoices = cache((orgId: string) =>
  unstable_cache(
    () =>
      db.customer.findMany({
        where: { orgId, isActive: true },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
      }),
    ['customer-choices-v1', orgId],
    { revalidate: 60 },
  )(),
)

/** The document before and after this one, in date then number order. A new form sits after the last. */
export async function neighbors(ctx: OrgContext, type: SalesDocumentType, currentId: string | null) {
  const base = { orgId: ctx.orgId, type, deletedAt: null as null }
  const pick = { id: true, number: true } as const

  if (currentId == null) {
    const previous = await db.salesDocument.findFirst({
      where: base,
      select: pick,
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
    })
    return { previous, next: null }
  }

  const current = await db.salesDocument.findFirst({
    where: { ...base, id: currentId },
    select: { id: true, number: true, date: true },
  })
  if (!current) return { previous: null, next: null }

  // Same order as the register: date asc, then number asc — two keyed lookups, not the whole list.
  const before = {
    OR: [
      { date: { lt: current.date } },
      { date: current.date, number: { lt: current.number } },
    ],
  }
  const after = {
    OR: [
      { date: { gt: current.date } },
      { date: current.date, number: { gt: current.number } },
    ],
  }

  const [previous, next] = await Promise.all([
    db.salesDocument.findFirst({
      where: { ...base, ...before },
      select: pick,
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
    }),
    db.salesDocument.findFirst({
      where: { ...base, ...after },
      select: pick,
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
    }),
  ])
  return { previous, next }
}

/** Receipts matching a number, a date, an amount, or the latest ones when nothing is typed. */
export type SalesFindAmountOp = 'eq' | 'gt' | 'lt' | 'gte' | 'lte'

/** Pull `> 100` / `<=50` out of the amount box the way QuickBooks Find does. */
function parseAmountFilter(
  amountRaw?: string,
  amountOp?: SalesFindAmountOp,
): { money: Decimal; op: SalesFindAmountOp } | null {
  const text = amountRaw?.trim() ?? ''
  if (!text) return null
  const matched = text.match(/^(>=|<=|>|<|=)\s*(.+)$/)
  const opFromText =
    matched?.[1] === '>='
      ? 'gte'
      : matched?.[1] === '<='
        ? 'lte'
        : matched?.[1] === '>'
          ? 'gt'
          : matched?.[1] === '<'
            ? 'lt'
            : matched?.[1] === '='
              ? 'eq'
              : null
  const valueText = matched?.[2]?.trim() ?? text
  const money = parseMoneyInput(valueText)
  if (!money) return null
  return {
    money: money.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    op: opFromText ?? amountOp ?? 'eq',
  }
}

function totalFilter(
  money: Decimal,
  op: SalesFindAmountOp,
): Prisma.DecimalFilter {
  switch (op) {
    case 'gt':
      return { gt: money }
    case 'lt':
      return { lt: money }
    case 'gte':
      return { gte: money }
    case 'lte':
      return { lte: money }
    case 'eq':
    default:
      return { gte: money, lt: money.plus('0.005') }
  }
}

/**
 * Find a sales paper by number, date, and/or amount — same idea as QuickBooks
 * Desktop Find. An empty search returns the latest of that type.
 */
export async function findDocuments(
  ctx: OrgContext,
  input: {
    type: SalesDocumentType
    number?: string
    date?: string
    amount?: string
    amountOp?: SalesFindAmountOp
  },
) {
  const number = input.number?.trim()
  const date = input.date?.trim()
  const amountFilter = parseAmountFilter(input.amount, input.amountOp)
  const where: Prisma.SalesDocumentWhereInput = {
    orgId: ctx.orgId,
    type: input.type,
    deletedAt: null,
    ...(number ? { number: { contains: number, mode: 'insensitive' } } : {}),
    ...(date && isCalendarDate(date) ? { date: toDate(date) } : {}),
    ...(amountFilter ? { total: totalFilter(amountFilter.money, amountFilter.op) } : {}),
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

/** @deprecated Prefer findDocuments — kept for older call sites. */
export async function findReceipts(
  ctx: OrgContext,
  input: { number?: string; date?: string; amount?: string; amountOp?: SalesFindAmountOp },
) {
  return findDocuments(ctx, { type: 'SALES_RECEIPT', ...input })
}

const DETAIL_SELECT = {
  ...DOCUMENT_SELECT,
  lines: {
    orderBy: { lineNumber: 'asc' },
    select: {
      id: true, lineNumber: true, description: true, quantity: true, quantityInvoiced: true, unitPrice: true,
      discountPercent: true, amount: true, taxAmount: true, serviceDate: true, storeId: true,
      lotNumber: true, serialNumber: true, lotExpiryDate: true,
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
      quantityInvoiced: line.quantityInvoiced.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent?.toString() ?? null,
      amount: line.amount.toString(),
      taxAmount: line.taxAmount.toString(),
      lotExpiryDate: line.lotExpiryDate ? toCalendarDate(line.lotExpiryDate) : null,
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
  orgId?: string,
): Promise<Map<string, Decimal>> {
  if (documentIds.length === 0) return new Map()

  const rows = orgId
    ? await client.$queryRaw<{ id: string; total: string; applied: string }[]>`
        SELECT d.id,
               d.total::text AS total,
               COALESCE(SUM(a.amount), 0)::text AS applied
          FROM sales_documents d
          LEFT JOIN sales_applications a
            ON a."invoiceId" = d.id AND a."orgId" = d."orgId"
         WHERE d."orgId" = ${orgId}
           AND d.id = ANY(${documentIds})
         GROUP BY d.id, d.total
      `
    : await client.$queryRaw<{ id: string; total: string; applied: string }[]>`
        SELECT d.id,
               d.total::text AS total,
               COALESCE(SUM(a.amount), 0)::text AS applied
          FROM sales_documents d
          LEFT JOIN sales_applications a ON a."invoiceId" = d.id
         WHERE d.id = ANY(${documentIds})
         GROUP BY d.id, d.total
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
  return db.$transaction((tx) => createWithin(tx, ctx, type, input, meta, options))
}

/**
 * The body of `create`, taking the caller's transaction.
 *
 * Split out because invoicing against an estimate, quotation, or sales order —
 * and converting one outright — creates the new paper and updates the source in
 * the same breath. When creation opened its own transaction, a failure after the
 * invoice was written left it in the books with the source still showing nothing
 * invoiced. One unit of work or none.
 */
async function createWithin(
  tx: Tx,
  ctx: OrgContext,
  type: SalesDocumentType,
  input: SalesDocumentInput,
  meta: Awaited<ReturnType<typeof requestMeta>>,
  options?: { pos?: PosCheckoutMeta },
) {
  {
    const customer = await requireCustomer(tx, ctx, input.customerId)
    const projectId = await resolveProjectId(tx, ctx, input.projectId)
    const trackingCategoryId = await resolveTrackingCategoryId(tx, ctx, input.trackingCategoryId)
    const lines = await resolveLines(tx, ctx, input.lines, { customerId: input.customerId })
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

    await assertCreditLimit(tx, ctx, customer, type, isDraft, priced.total, {
      acknowledgeCreditLimit: input.acknowledgeCreditLimit,
    })

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

    const docCurrency =
      (input.currencyCode ?? customer.currencyCode ?? ctx.organization.baseCurrency).toUpperCase()
    const exchangeRate = new Decimal(input.exchangeRate ?? 1)
    if (exchangeRate.lessThanOrEqualTo(0)) {
      throw validation('Exchange rate must be greater than zero.')
    }

    // POS must post immediately. Desk sales (incl. orders / estimates) may wait.
    const gate =
      !isDraft && !options?.pos
        ? await approvalService.needsApproval(ctx, 'SALES_DOCUMENT', priced.total, tx, type)
        : { required: false, levels: 1, requireDifferentApprover: true }
    const holdForApproval = gate.required

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
        status: isDraft ? 'DRAFT' : holdForApproval ? 'PENDING_APPROVAL' : 'OPEN',
        reference: input.reference ?? null,
        inRef: input.inRef ?? null,
        prescriptionRef: input.prescriptionRef ?? null,
        retentionAmount: input.retentionAmount ? input.retentionAmount : null,
        progressPercent: input.progressPercent ? input.progressPercent : null,
        memo: input.memo ?? null,
        customerMessage: input.customerMessage ?? null,
        workScope: input.workScope ?? null,
        workSite: input.workSite ?? null,
        subtotal: priced.subtotal.toFixed(4),
        discountAmount: priced.discountAmount.toFixed(4),
        taxTotal: priced.taxTotal.toFixed(4),
        total: priced.total.toFixed(4),
        currencyCode: docCurrency,
        exchangeRate: exchangeRate.toFixed(9),
        depositAccountId: input.depositAccountId ?? null,
        paymentMethod:
          type === 'SALES_RECEIPT' || type === 'REFUND_RECEIPT' ? (input.paymentMethod ?? null) : null,
        projectId,
        trackingCategoryId,
        createdById: ctx.userId,
        lines: {
          create: priced.lines.map((line) => ({
            orgId: ctx.orgId,
            lineNumber: line.lineNumber,
            itemId: line.source.itemId ?? null,
            storeId: line.source.storeId ?? null,
            lotNumber: line.source.lotNumber?.trim() || null,
            serialNumber: line.source.serialNumber?.trim() || null,
            lotExpiryDate: line.source.lotExpiryDate
              ? toDate(line.source.lotExpiryDate)
              : null,
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
            sourcePurchaseLineId: line.source.sourcePurchaseLineId ?? null,
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
          clientSaleId: options.pos.clientSaleId ?? null,
          changeAmount: options.pos.change?.amount ?? '0',
          changePaymentMethodId: options.pos.change?.paymentMethodId ?? null,
          changeLedgerAccountId: options.pos.change?.ledgerAccountId ?? null,
          depositLedgerAccountId: options.pos.depositLedgerAccountId ?? null,
          tipAmount: options.pos.tipAmount ?? '0',
          diningTableId: options.pos.diningTableId ?? null,
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

    if (holdForApproval) {
      const cfg = salesByType(type)
      await approvalService.submitRequest(tx, ctx, {
        entityType: 'SALES_DOCUMENT',
        entityId: document.id,
        title: `${cfg.singular} ${document.number}`,
        href: `/sales/${cfg.slug}/${document.id}`,
        amount: document.total,
        currencyCode: docCurrency,
        levels: gate.levels,
      })
    } else if (!isDraft && POSTS_A_JOURNAL[type]) {
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
  }
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
      convertedTo: { select: { number: true }, take: 1 },
    },
  })
  if (!source) throw notFound('Document')
  if (source.convertedTo.length > 0) {
    const prior = source.convertedTo[0]!
    throw conflict(`${source.number} has already become ${prior.number}.`)
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
      select: {
        id: true,
        type: true,
        number: true,
        status: true,
        journalId: true,
        version: true,
        total: true,
        currencyCode: true,
        exchangeRate: true,
      },
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
    const projectId = await resolveProjectId(tx, ctx, input.projectId)
    const trackingCategoryId = await resolveTrackingCategoryId(tx, ctx, input.trackingCategoryId)
    const lines = await resolveLines(tx, ctx, input.lines, {
      customerId: input.customerId,
      excludeDocumentId: id,
    })
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

    await assertCreditLimit(tx, ctx, customer, existing.type, isDraft, priced.total, {
      excludeDocumentId: existing.id,
      acknowledgeCreditLimit: input.acknowledgeCreditLimit,
    })

    const term = input.paymentTermId
      ? await tx.paymentTerm.findFirst({
          where: { id: input.paymentTermId, orgId: ctx.orgId },
          select: { id: true, type: true, dueDays: true },
        })
      : customer.paymentTerm

    const docCurrency =
      (input.currencyCode ?? customer.currencyCode ?? existing.currencyCode ?? ctx.organization.baseCurrency).toUpperCase()
    const exchangeRate = new Decimal(input.exchangeRate ?? existing.exchangeRate?.toString() ?? 1)
    if (exchangeRate.lessThanOrEqualTo(0)) {
      throw validation('Exchange rate must be greater than zero.')
    }

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

    const gate = !input.saveAsDraft
      ? await approvalService.needsApproval(ctx, 'SALES_DOCUMENT', priced.total, tx, existing.type)
      : { required: false, levels: 1, requireDifferentApprover: true }
    const holdForApproval = gate.required

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
        inRef: input.inRef ?? null,
        prescriptionRef: input.prescriptionRef ?? null,
        retentionAmount: input.retentionAmount ? input.retentionAmount : null,
        progressPercent: input.progressPercent ? input.progressPercent : null,
        memo: input.memo ?? null,
        customerMessage: input.customerMessage ?? null,
        workScope: input.workScope ?? null,
        workSite: input.workSite ?? null,
        subtotal: priced.subtotal.toFixed(4),
        discountAmount: priced.discountAmount.toFixed(4),
        taxTotal: priced.taxTotal.toFixed(4),
        total: priced.total.toFixed(4),
        currencyCode: docCurrency,
        exchangeRate: exchangeRate.toFixed(9),
        depositAccountId: input.depositAccountId ?? null,
        ...(existing.type === 'SALES_RECEIPT' || existing.type === 'REFUND_RECEIPT'
          ? { paymentMethod: input.paymentMethod ?? null }
          : {}),
        projectId,
        trackingCategoryId,
        journalId: null,
        version: { increment: 1 },
        status: input.saveAsDraft ? 'DRAFT' : holdForApproval ? 'PENDING_APPROVAL' : 'OPEN',
        lines: {
          create: priced.lines.map((line) => ({
            orgId: ctx.orgId,
            lineNumber: line.lineNumber,
            itemId: line.source.itemId ?? null,
            storeId: line.source.storeId ?? null,
            lotNumber: line.source.lotNumber?.trim() || null,
            serialNumber: line.source.serialNumber?.trim() || null,
            lotExpiryDate: line.source.lotExpiryDate
              ? toDate(line.source.lotExpiryDate)
              : null,
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
            sourcePurchaseLineId: line.source.sourcePurchaseLineId ?? null,
          })),
        },
      },
    })

    if (holdForApproval) {
      const cfg = salesByType(existing.type)
      await approvalService.submitRequest(tx, ctx, {
        entityType: 'SALES_DOCUMENT',
        entityId: id,
        title: `${cfg.singular} ${number}`,
        href: `/sales/${cfg.slug}/${id}`,
        amount: priced.total,
        currencyCode: docCurrency,
        levels: gate.levels,
      })
    } else if (!input.saveAsDraft && POSTS_A_JOURNAL[existing.type]) {
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
      status: true, depositAccountId: true, journalId: true, discountAmount: true,
      retentionAmount: true,
      trackingCategoryId: true, currencyCode: true, exchangeRate: true,
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true, amount: true, taxAmount: true, taxCodeId: true, incomeAccountId: true,
          description: true, quantity: true, unitPrice: true, discountPercent: true, itemId: true, storeId: true,
          lotNumber: true, serialNumber: true,
          item: {
            select: {
              id: true,
              name: true,
              type: true,
              inventoryAccountId: true,
              cogsAccountId: true,
              depositAccountId: true,
              incomeAccountId: true,
              bomParents: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  quantity: true,
                  component: {
                    select: {
                      id: true,
                      name: true,
                      type: true,
                      inventoryAccountId: true,
                      cogsAccountId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!document) throw notFound('Document')
  // Estimates / quotations / sales orders have no journal — approval only opens them.
  if (!POSTS_A_JOURNAL[document.type]) {
    if (document.status === 'PENDING_APPROVAL') {
      await tx.salesDocument.update({
        where: { id: document.id },
        data: { status: 'OPEN' },
      })
    }
    return null
  }
  if (document.journalId) throw conflict(`${document.number} is already posted.`)

  for (const [index, line] of document.lines.entries()) {
    if (!line.itemId) {
      throw validation(
        'Every posted sales line must use a product or service from the item list. A name typed by hand is not a registered sale.',
        { lines: [`Line ${index + 1}: choose an item from Products and services`] },
      )
    }
    if (line.item?.type === 'GROUP') {
      if (!line.item.bomParents.length) {
        throw precondition(
          `"${line.item.name}" has no members, so it cannot be sold as a kit.`,
        )
      }
      if (!line.item.incomeAccountId && !line.incomeAccountId) {
        throw precondition(
          `"${line.item.name}" needs an income account on the group before it can post as one line.`,
        )
      }
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
  const retentionHeld = new Decimal(document.retentionAmount?.toString() ?? '0')
  if (document.type === 'INVOICE' && retentionHeld.greaterThan(0)) {
    // Ensure Contract Retention Receivable exists on older charts.
    await seedChartOfAccounts(tx, ctx.orgId)
  }
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
    retention:
      document.type === 'INVOICE' && retentionHeld.greaterThan(0)
        ? {
            accountId: await systemAccountId(tx, ctx.orgId, 'RETENTION_RECEIVABLE'),
            amount: retentionHeld,
          }
        : null,
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
    // Cost posts to each item's Cost of Goods Sold account (QuickBooks-style).
    // Headings resolve to a single leaf when unambiguous; otherwise the cashier
    // must map the product to a postable sub-account.
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

    // Stock issues from a sale: inventory and assembly lines move themselves;
    // a GROUP kit issues each member (Phase 11.13). Assemblies that are sold
    // as finished goods (or as kit members) must already be built.
    type StockIssue = {
      lineId: string
      itemId: string
      itemName: string
      itemType: string
      inventoryAccountId: string
      cogsAccountId: string | null
      quantity: Decimal
      storeId: string | null
      lotNumber: string | null
      serialNumber: string | null
    }
    const stockIssues: StockIssue[] = []
    for (const line of document.lines) {
      const item = line.item
      if (!item) continue
      const lineQty = new Decimal(line.quantity.toString())
      if (item.type === 'INVENTORY' || item.type === 'INVENTORY_ASSEMBLY') {
        if (!item.inventoryAccountId) {
          throw precondition(`"${item.name}" has no inventory account.`)
        }
        stockIssues.push({
          lineId: line.id,
          itemId: item.id,
          itemName: item.name,
          itemType: item.type,
          inventoryAccountId: item.inventoryAccountId,
          cogsAccountId: item.cogsAccountId,
          quantity: lineQty,
          storeId: line.storeId,
          lotNumber: line.lotNumber ?? null,
          serialNumber: line.serialNumber ?? null,
        })
        continue
      }
      if (item.type !== 'GROUP') continue
      for (const row of item.bomParents) {
        const member = row.component
        if (member.type !== 'INVENTORY' && member.type !== 'INVENTORY_ASSEMBLY') continue
        if (!member.inventoryAccountId) {
          throw precondition(`"${member.name}" (in kit "${item.name}") has no inventory account.`)
        }
        stockIssues.push({
          lineId: line.id,
          itemId: member.id,
          itemName: member.name,
          itemType: member.type,
          inventoryAccountId: member.inventoryAccountId,
          cogsAccountId: member.cogsAccountId,
          quantity: lineQty.times(new Decimal(row.quantity.toString())),
          storeId: line.storeId,
          // Kit members inherit the parent line's lot/serial when present.
          lotNumber: line.lotNumber ?? null,
          serialNumber: line.serialNumber ?? null,
        })
      }
    }

    if (movesStockOut) {
      const assemblyNeed = new Map<string, { name: string; needed: Decimal }>()
      for (const issue of stockIssues) {
        if (issue.itemType !== 'INVENTORY_ASSEMBLY') continue
        const prior = assemblyNeed.get(issue.itemId)
        if (prior) prior.needed = prior.needed.plus(issue.quantity)
        else assemblyNeed.set(issue.itemId, { name: issue.itemName, needed: issue.quantity })
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

    for (const issue of stockIssues) {
      const inventoryAccountId =
        (issue.storeId && storeAccounts.get(issue.storeId)) || issue.inventoryAccountId
      const quantity = issue.quantity
      const movement = await recordMovement(tx, ctx, {
        itemId: issue.itemId,
        date: toCalendarDate(document.date),
        type: movesStockOut ? 'SALE' : 'SALE_RETURN',
        sourceType: document.type as never,
        sourceId: document.id,
        sourceLineId: issue.lineId,
        quantity: movesStockOut ? quantity.negated() : quantity,
        storeId: issue.storeId,
        lotNumber: issue.lotNumber,
        serialNumber: issue.serialNumber,
      })

      if (movesStockOut) {
        saleMovements.push({
          lineId: issue.lineId,
          itemId: issue.itemId,
          storeId: issue.storeId,
          quantity,
          unitCost: movement.unitCost,
          value: movement.value,
        })
      }

      const cogsAccountId = await resolvePostableCogsAccountId(tx, ctx.orgId, issue.cogsAccountId)
      const key = `${cogsAccountId}|${inventoryAccountId}`
      const existing = cogs.get(key)
      const amount = movement.value.abs()
      if (existing) existing.amount = existing.amount.plus(amount)
      else
        cogs.set(key, {
          cogsAccountId,
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

  if (document.trackingCategoryId) {
    for (const line of draft.lines) line.trackingCategoryId = document.trackingCategoryId
  }

  draft.currencyCode = document.currencyCode
  draft.exchangeRate = document.exchangeRate?.toString() ?? 1

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
        deletedAt: true, convertedFromId: true,
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

    // An invoice raised against an estimate, quotation, or sales order hands its
    // quantities back first — before the link is cleared, which is the only
    // record of which source it billed.
    if (document.convertedFromId) {
      await restoreSourceQuantities(tx, ctx, document.convertedFromId, id)
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
        convertedFromId: true,
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

    if (document.convertedFromId) {
      await applySourceQuantities(tx, ctx, document.convertedFromId, id)
    }

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
export function listConvertibleSources(
  ctx: OrgContext,
  options: { types?: SalesDocumentType[] } = {},
) {
  const types = options.types?.length ? options.types : CONVERTIBLE_SOURCES
  return cachedConvertible(ctx.orgId, types.join(','))
}

const cachedConvertible = cache((orgId: string, typeKey: string) =>
  unstable_cache(
    () => queryConvertibleSources(orgId, typeKey.split(',') as SalesDocumentType[]),
    ['convertible-sources-v1', orgId, typeKey],
    { revalidate: 20 },
  )(),
)

async function queryConvertibleSources(orgId: string, types: SalesDocumentType[]) {
  const rows = await db.salesDocument.findMany({
    where: {
      orgId,
      type: { in: types },
      status: { notIn: ['VOID', 'DECLINED', 'CLOSED'] },
      convertedTo: { none: {} },
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
      convertedTo: { none: {} },
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
      workScope: true,
      workSite: true,
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
          item: { select: { name: true, sku: true, unitOfMeasure: true } },
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
    workScope: row.workScope,
    workSite: row.workSite,
    paymentTermId: row.paymentTermId,
    discountAmount: row.discountAmount.toString(),
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      itemName: line.item?.name ?? null,
      itemSku: line.item?.sku ?? null,
      unitOfMeasure: line.item?.unitOfMeasure ?? null,
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
 * What is on an estimate, quotation, or sales order, what has been invoiced,
 * and what is still to bill.
 *
 * The invoicing screen is built from this and nothing else, so what it shows and
 * what the service will accept cannot drift apart.
 */
export type InvoiceableLine = {
  lineId: string
  lineNumber: number
  itemId: string | null
  itemName: string | null
  sku: string | null
  unitOfMeasure: string | null
  isTracked: boolean
  /** Store named on the source line — where the goods leave from. */
  storeId: string | null
  description: string | null
  unitPrice: string
  ordered: string
  invoiced: string
  remaining: string
}

export async function invoiceableSource(
  ctx: OrgContext,
  sourceId: string,
  options: { client?: Tx } = {},
) {
  const client = options.client ?? db
  const source = await client.salesDocument.findFirst({
    where: { id: sourceId, orgId: ctx.orgId, type: { in: CONVERTIBLE_SOURCES } },
    select: {
      id: true, number: true, type: true, status: true, date: true, reference: true, inRef: true, memo: true,
      customer: { select: { id: true, displayName: true } },
      convertedTo: {
        select: { id: true, number: true, type: true, date: true, status: true },
        orderBy: { date: 'asc' },
      },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true, lineNumber: true, itemId: true, storeId: true, description: true,
          quantity: true, quantityInvoiced: true, unitPrice: true,
          item: { select: { name: true, sku: true, type: true, unitOfMeasure: true } },
        },
      },
    },
  })
  if (!source) throw notFound('Document')

  const lines: InvoiceableLine[] = source.lines.map((line) => {
    const ordered = new Decimal(line.quantity.toString())
    const invoiced = new Decimal(line.quantityInvoiced.toString())
    return {
      lineId: line.id,
      lineNumber: line.lineNumber,
      itemId: line.itemId,
      itemName: line.item?.name ?? null,
      sku: line.item?.sku ?? null,
      unitOfMeasure: line.item?.unitOfMeasure ?? null,
      isTracked: line.item?.type === 'INVENTORY' || line.item?.type === 'INVENTORY_ASSEMBLY',
      storeId: line.storeId,
      description: line.description,
      unitPrice: line.unitPrice.toString(),
      ordered: ordered.toFixed(2),
      invoiced: invoiced.toFixed(2),
      // Over-billing is refused, so nothing outstanding is ever negative even if
      // an earlier invoice was withdrawn by hand.
      remaining: Decimal.max(ordered.minus(invoiced), 0).toFixed(2),
    }
  })

  return {
    id: source.id,
    number: source.number,
    type: source.type,
    status: source.status,
    date: source.date,
    reference: source.reference,
    inRef: source.inRef,
    memo: source.memo,
    customer: source.customer,
    invoices: source.convertedTo,
    lines,
    fullyInvoiced: lines.every((line) => new Decimal(line.remaining).isZero()),
  }
}

/**
 * Invoice part of an estimate, quotation, or sales order.
 *
 * A proposal is rarely billed in one go, and this used to be all or nothing:
 * one button that turned the whole paper into an invoice for everything on it,
 * whether or not that much was ready to bill. If half was done, the choice was
 * to invoice work that had not happened — inflating receivables — or to record
 * nothing until the rest was finished. Both are wrong, and the second is what
 * people did.
 *
 * So an invoice is a quantity per line. It raises an invoice for exactly what
 * is being billed now; the source keeps count of what is still open and closes
 * itself when nothing is left. Billing the balance later is the same act again.
 *
 * The invoice is the accounting document — this is not a second ledger. All the
 * source carries is the count, and this service is its only writer.
 */
export async function invoiceFromSource(ctx: OrgContext, input: InvoiceFromSourceInput) {
  const meta = await requestMeta()
  return db.$transaction((tx) =>
    invoiceSourceWithin(tx, ctx, meta, { ...input, target: 'INVOICE' }),
  )
}

async function invoiceSourceWithin(
  tx: Tx,
  ctx: OrgContext,
  meta: Awaited<ReturnType<typeof requestMeta>>,
  input: InvoiceFromSourceInput & {
    target: 'INVOICE' | 'SALES_RECEIPT'
    depositAccountId?: string | null
  },
) {
  const source = await tx.salesDocument.findFirst({
    where: { id: input.sourceId, orgId: ctx.orgId, type: { in: CONVERTIBLE_SOURCES } },
    select: {
      id: true, number: true, type: true, status: true, customerId: true, reference: true, inRef: true, memo: true,
      customerMessage: true, workScope: true, workSite: true, paymentTermId: true, projectId: true,
      trackingCategoryId: true,
      discountAmount: true,
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true, lineNumber: true, itemId: true, storeId: true, description: true,
          quantity: true, quantityInvoiced: true, unitPrice: true,
          discountPercent: true, taxCodeId: true, serviceDate: true,
        },
      },
    },
  })
  if (!source) throw notFound('Document')

  if (source.status === 'VOID' || source.status === 'DECLINED') {
    throw precondition(`${source.number} is ${source.status.toLowerCase()} and cannot be invoiced.`)
  }
  if (source.status === 'DRAFT') {
    throw precondition(
      `${source.number} is still a draft. Save it before invoicing against it.`,
    )
  }
  if (source.status === 'CLOSED') {
    throw conflict(`${source.number} is closed — everything on it has already been invoiced.`)
  }

  const byId = new Map(source.lines.map((line) => [line.id, line]))
  const invoicing = new Map<string, Decimal>()

  for (const request of input.lines) {
    const line = byId.get(request.lineId)
    if (!line) throw notFound('Document line')

    const quantity = new Decimal(request.quantity)
    if (quantity.isZero()) continue
    if (quantity.isNegative()) {
      throw validation('An invoiced quantity cannot be negative. To give money back, raise a credit memo.')
    }

    const remaining = new Decimal(line.quantity.toString()).minus(line.quantityInvoiced.toString())
    if (quantity.greaterThan(remaining)) {
      throw validation(
        `Line ${line.lineNumber} has ${remaining.toFixed(2)} still to bill and you have entered ` +
          `${quantity.toFixed(2)}. Invoice what is due; if more was agreed than is on the paper, ` +
          `amend it first so the paperwork matches the bill.`,
        { [`lines.${line.lineNumber}.quantity`]: [`At most ${remaining.toFixed(2)}`] },
      )
    }

    invoicing.set(line.id, quantity)
  }

  if (invoicing.size === 0) {
    throw validation('Enter a quantity against at least one line.')
  }

  const coversEverything = source.lines.every((line) => {
    const already = new Decimal(line.quantityInvoiced.toString())
    const now = invoicing.get(line.id) ?? ZERO
    return already.isZero() && now.equals(new Decimal(line.quantity.toString()))
  })
  const discount = new Decimal(source.discountAmount.toString())

  const created = await createWithin(
    tx,
    ctx,
    input.target,
    {
      customerId: source.customerId,
      date: input.date,
      reference: input.reference ?? source.reference,
      inRef: source.inRef,
      memo:
        input.memo ??
        [`Invoiced against ${source.number}`, source.memo].filter(Boolean).join(' — '),
      customerMessage: source.customerMessage,
      workScope: source.workScope,
      workSite: source.workSite,
      paymentTermId: input.target === 'INVOICE' ? source.paymentTermId : null,
      depositAccountId: input.target === 'SALES_RECEIPT' ? (input.depositAccountId ?? null) : null,
      projectId: source.projectId,
      trackingCategoryId: source.trackingCategoryId,
      discountKind: 'amount',
      discountValue: coversEverything && discount.greaterThan(0) ? discount.toString() : null,
      lines: source.lines
        .filter((line) => invoicing.has(line.id))
        .map((line) => ({
          itemId: line.itemId,
          storeId: line.storeId,
          description: line.description,
          quantity: invoicing.get(line.id)!.toString(),
          unitPrice: line.unitPrice.toString(),
          discountPercent: line.discountPercent?.toString() ?? null,
          taxCodeId: line.taxCodeId,
          serviceDate: line.serviceDate ? toCalendarDate(line.serviceDate) : null,
        })),
    } as SalesDocumentInput,
    meta,
  )

  await tx.salesDocument.update({
    where: { id: created.id },
    data: { convertedFromId: source.id },
  })

  for (const [lineId, quantity] of invoicing) {
    await tx.salesDocumentLine.update({
      where: { id: lineId },
      data: { quantityInvoiced: { increment: quantity.toFixed(4) } },
    })
  }

  // Closed once nothing is outstanding; otherwise it stays open, showing what
  // is still to bill rather than disappearing off the list of live papers.
  const outstanding = source.lines.reduce((total, line) => {
    const invoiced = new Decimal(line.quantityInvoiced.toString()).plus(invoicing.get(line.id) ?? 0)
    return total.plus(Decimal.max(new Decimal(line.quantity.toString()).minus(invoiced), 0))
  }, new Decimal(0))

  const status = outstanding.isZero() ? 'CLOSED' : 'PARTIAL'
  await tx.salesDocument.update({ where: { id: source.id }, data: { status } })

  await writeAudit(
    tx,
    ctx,
    {
      entity: 'SalesDocument',
      entityId: source.id,
      action: 'UPDATE',
      after: {
        invoiced: created.number,
        lines: invoicing.size,
        status,
        outstanding: outstanding.toFixed(2),
      },
    },
    meta,
  )

  return { ...created, sourceNumber: source.number, sourceStatus: status }
}

/**
 * Put a deleted invoice's quantities back on the estimate, quotation, or sales
 * order it was billed against.
 *
 * The source's count is the only thing in the system that would otherwise be
 * left stating something untrue: it would still say ten were invoiced when the
 * invoice saying so has been withdrawn. The status follows the count back — a
 * paper with nothing invoiced is open again, not closed.
 */
async function restoreSourceQuantities(
  tx: Tx,
  ctx: OrgContext,
  sourceId: string,
  invoiceId: string,
): Promise<void> {
  const [source, invoice] = await Promise.all([
    tx.salesDocument.findFirst({
      where: { id: sourceId, orgId: ctx.orgId, type: { in: CONVERTIBLE_SOURCES } },
      select: {
        id: true, status: true,
        lines: { select: { id: true, itemId: true, description: true, quantity: true, quantityInvoiced: true } },
      },
    }),
    tx.salesDocument.findFirst({
      where: { id: invoiceId, orgId: ctx.orgId },
      select: { lines: { select: { itemId: true, description: true, quantity: true } } },
    }),
  ])
  if (!source || !invoice) return

  // Invoice lines are copied from the source's, so they match on what identifies
  // a line: the item, or the description where there is no item.
  const remainingByKey = new Map<string, Decimal>()
  for (const line of invoice.lines) {
    const key = line.itemId ?? `text:${line.description ?? ''}`
    remainingByKey.set(key, (remainingByKey.get(key) ?? ZERO).plus(new Decimal(line.quantity.toString())))
  }

  for (const line of source.lines) {
    const key = line.itemId ?? `text:${line.description ?? ''}`
    const giveBack = remainingByKey.get(key)
    if (!giveBack || giveBack.isZero()) continue

    const invoiced = new Decimal(line.quantityInvoiced.toString())
    const restored = Decimal.max(invoiced.minus(giveBack), 0)

    await tx.salesDocumentLine.update({
      where: { id: line.id },
      data: { quantityInvoiced: restored.toFixed(4) },
    })

    remainingByKey.set(key, ZERO)
  }

  await refreshSourceInvoiceStatus(tx, sourceId, source.status)
}

/** Put invoiced quantities back on the source when a deleted invoice is restored. */
async function applySourceQuantities(
  tx: Tx,
  ctx: OrgContext,
  sourceId: string,
  invoiceId: string,
): Promise<void> {
  const [source, invoice] = await Promise.all([
    tx.salesDocument.findFirst({
      where: { id: sourceId, orgId: ctx.orgId, type: { in: CONVERTIBLE_SOURCES } },
      select: {
        id: true, status: true,
        lines: { select: { id: true, itemId: true, description: true, quantity: true, quantityInvoiced: true } },
      },
    }),
    tx.salesDocument.findFirst({
      where: { id: invoiceId, orgId: ctx.orgId, deletedAt: undefined },
      select: { lines: { select: { itemId: true, description: true, quantity: true } } },
    }),
  ])
  if (!source || !invoice) return

  const remainingByKey = new Map<string, Decimal>()
  for (const line of invoice.lines) {
    const key = line.itemId ?? `text:${line.description ?? ''}`
    remainingByKey.set(key, (remainingByKey.get(key) ?? ZERO).plus(new Decimal(line.quantity.toString())))
  }

  for (const line of source.lines) {
    const key = line.itemId ?? `text:${line.description ?? ''}`
    const addBack = remainingByKey.get(key)
    if (!addBack || addBack.isZero()) continue

    const invoiced = new Decimal(line.quantityInvoiced.toString())
    const ordered = new Decimal(line.quantity.toString())
    const next = Decimal.min(invoiced.plus(addBack), ordered)

    await tx.salesDocumentLine.update({
      where: { id: line.id },
      data: { quantityInvoiced: next.toFixed(4) },
    })

    remainingByKey.set(key, ZERO)
  }

  await refreshSourceInvoiceStatus(tx, sourceId, source.status)
}

async function refreshSourceInvoiceStatus(
  tx: Tx,
  sourceId: string,
  status: string,
) {
  const refreshed = await tx.salesDocumentLine.findMany({
    where: { documentId: sourceId },
    select: { quantity: true, quantityInvoiced: true },
  })

  const outstanding = refreshed.reduce(
    (total, line) =>
      total.plus(
        Decimal.max(new Decimal(line.quantity.toString()).minus(line.quantityInvoiced.toString()), 0),
      ),
    ZERO,
  )
  const anyInvoiced = refreshed.some((line) => !new Decimal(line.quantityInvoiced.toString()).isZero())

  if (status !== 'VOID' && status !== 'DRAFT' && status !== 'DECLINED') {
    await tx.salesDocument.update({
      where: { id: sourceId },
      data: { status: outstanding.isZero() ? 'CLOSED' : anyInvoiced ? 'PARTIAL' : 'OPEN' },
    })
  }
}

/**
 * Turn an estimate, quotation, or sales order into the next paper.
 *
 * Paths match QuickBooks Online + Desktop:
 * - Proposal → invoice (bill later) — the quantity still open, and again later
 * - Proposal → sales receipt (paid now) — the same, until nothing is left
 * - Proposal → sales order (Desktop: accept, fulfill later) — once, and it closes
 * - Sales order → invoice or sales receipt (collect) — the quantity still open
 *
 * The source is kept. An invoice or receipt leaves it open while anything
 * remains; a sales order closes it in one step.
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

  // Invoice and sales receipt bill whatever is still open, and may be repeated
  // until the source is fully invoiced. A sales order is one paper, once.
  if (target === 'INVOICE' || target === 'SALES_RECEIPT') {
    const view = await invoiceableSource(ctx, sourceId)
    const lines = view.lines
      .filter((line) => !new Decimal(line.remaining).isZero())
      .map((line) => ({ lineId: line.lineId, quantity: line.remaining }))
    if (lines.length === 0) {
      throw conflict(`${view.number} is closed — everything on it has already been invoiced.`)
    }
    if (target === 'INVOICE') {
      const created = await invoiceFromSource(ctx, { sourceId, date, lines })
      return { ...created, type: target }
    }
    return db.$transaction(async (tx) => {
      const created = await invoiceSourceWithin(tx, ctx, meta, {
        sourceId,
        date,
        lines,
        target,
        depositAccountId,
      })
      return { ...created, type: target }
    })
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
        projectId: true,
        trackingCategoryId: true,
        reference: true,
        inRef: true,
        memo: true,
        customerMessage: true,
        workScope: true,
        workSite: true,
        paymentTermId: true,
        discountAmount: true,
        convertedTo: { select: { number: true, type: true }, take: 1 },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            itemId: true,
            description: true,
            quantity: true,
            quantityInvoiced: true,
            unitPrice: true,
            discountPercent: true,
            taxCodeId: true,
            storeId: true,
            serviceDate: true,
          },
        },
      },
    })
    if (!source) throw notFound('Document')
    if (source.convertedTo.length > 0) {
      const prior = source.convertedTo[0]!
      throw conflict(`${source.number} has already become ${prior.number}.`)
    }
    if (source.lines.some((line) => !new Decimal(line.quantityInvoiced.toString()).isZero())) {
      throw conflict(
        `${source.number} has already been invoiced in part. Finish it with an invoice or a sales receipt.`,
      )
    }
    if (source.status === 'VOID' || source.status === 'DECLINED' || source.status === 'CLOSED') {
      throw precondition(
        `${source.number} is ${source.status.toLowerCase()} and cannot be converted.`,
      )
    }
    if (source.type === 'SALES_ORDER') {
      throw precondition('A sales order cannot become another sales order.')
    }

    const discount = new Decimal(source.discountAmount.toString())
    const created = await createWithin(
      tx,
      ctx,
      'SALES_ORDER',
      {
        customerId: source.customerId,
        date,
        reference: source.reference,
        inRef: source.inRef,
        memo: source.memo,
        customerMessage: source.customerMessage,
        workScope: source.workScope,
        workSite: source.workSite,
        paymentTermId: source.paymentTermId,
        projectId: source.projectId,
        trackingCategoryId: source.trackingCategoryId,
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
          serviceDate: line.serviceDate ? toCalendarDate(line.serviceDate) : null,
        })),
      } as SalesDocumentInput,
      meta,
    )

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
      creditLimit: true,
      currencyCode: true,
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
 * An invoice that would push the customer past their credit limit is refused.
 * Estimates, quotations, orders and cash receipts do not consume the limit —
 * only an open receivable does. Drafts are allowed so the clerk can save and
 * come back; posting is when the check bites.
 */
async function assertCreditLimit(
  tx: Tx,
  ctx: OrgContext,
  customer: { id: string; displayName: string; creditLimit: { toString(): string } | null },
  type: SalesDocumentType,
  isDraft: boolean,
  invoiceTotal: Decimal,
  options?: { excludeDocumentId?: string; acknowledgeCreditLimit?: boolean },
) {
  if (isDraft || type !== 'INVOICE') return
  if (!customer.creditLimit) return
  const limit = new Decimal(customer.creditLimit.toString())
  if (limit.lessThanOrEqualTo(0)) return

  const balances = await subledgerBalances(tx, ctx, 'customer', [customer.id])
  let owed = balances.get(customer.id) ?? ZERO

  // Editing an already-posted invoice: take its current open balance out of
  // "owed" before adding the new total, so a same-size edit does not double-count.
  if (options?.excludeDocumentId) {
    const open = await outstandingBalances(tx, [options.excludeDocumentId])
    owed = owed.minus(open.get(options.excludeDocumentId) ?? ZERO)
  }

  const projected = owed.plus(invoiceTotal)
  if (projected.greaterThan(limit)) {
    const currency = ctx.organization.baseCurrency
    const message =
      `${customer.displayName} would owe ${formatMoney(projected, currency)} after this invoice, ` +
      `which exceeds their credit limit of ${formatMoney(limit, currency)}. ` +
      `Collect a payment, raise the limit, or save the invoice as a draft.`
    if (ctx.features.creditLimitWarn) {
      if (options?.acknowledgeCreditLimit) return
      throw validation(message, {
        acknowledgeCreditLimit: [
          'This invoice exceeds the credit limit. Confirm to post anyway, or save as a draft.',
        ],
      })
    }
    throw precondition(message)
  }
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
    if (line.itemId || line.sourcePurchaseLineId) continue
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
  options?: { customerId?: string; excludeDocumentId?: string },
): Promise<DraftSalesLine[]> {
  const itemIds = lines.map((line) => line.itemId).filter(Boolean) as string[]

  const items = itemIds.length
    ? await tx.item.findMany({
        where: { id: { in: itemIds }, orgId: ctx.orgId },
        select: {
          id: true, name: true, type: true, isActive: true, salesPrice: true, wholesalePrice: true,
          salesDescription: true, description: true, incomeAccountId: true, salesTaxCodeId: true,
          inventoryAccountId: true, cogsAccountId: true, depositAccountId: true,
        },
      })
    : []

  const byId = new Map(items.map((item) => [item.id, item]))
  // Blank unit price: named price list → wholesale/retail level → item sales price,
  // then optional active % promotion.
  const customerPricing = options?.customerId
    ? await tx.customer.findFirst({
        where: { id: options.customerId, orgId: ctx.orgId },
        select: { priceLevel: true, priceListId: true },
      })
    : null
  const priceLevel = customerPricing?.priceLevel ?? 'RETAIL'
  const listPrices = new Map<string, string>()
  if (customerPricing?.priceListId && itemIds.length > 0) {
    const rows = await tx.priceListItem.findMany({
      where: {
        priceListId: customerPricing.priceListId,
        itemId: { in: itemIds },
      },
      select: { itemId: true, unitPrice: true },
    })
    for (const row of rows) {
      listPrices.set(row.itemId, row.unitPrice.toString())
    }
  }
  const asOf = today(ctx.organization.timeZone)
  const asOfDate = toDate(asOf)
  const promos =
    itemIds.length > 0
      ? await tx.itemPromotion.findMany({
          where: {
            orgId: ctx.orgId,
            isActive: true,
            startsOn: { lte: asOfDate },
            endsOn: { gte: asOfDate },
            OR: [{ itemId: { in: itemIds } }, { itemId: null }],
          },
          select: { itemId: true, percentOff: true },
        })
      : []
  const promoFor = (itemId: string | null | undefined): number => {
    if (!itemId) return 0
    let best = 0
    for (const promo of promos) {
      if (promo.itemId && promo.itemId !== itemId) continue
      const pct = Number(promo.percentOff.toString())
      if (pct > best) best = pct
    }
    return best
  }
  const purchaseLineIds = [
    ...new Set(lines.map((line) => line.sourcePurchaseLineId).filter((id): id is string => Boolean(id))),
  ]
  const billableRows = purchaseLineIds.length
    ? await tx.purchaseDocumentLine.findMany({
        where: { id: { in: purchaseLineIds }, orgId: ctx.orgId },
        select: {
          id: true,
          billableCustomerId: true,
          document: { select: { type: true, status: true, deletedAt: true, number: true } },
          billedInvoiceLine: { select: { id: true, documentId: true } },
        },
      })
    : []
  const billableById = new Map(billableRows.map((row) => [row.id, row]))
  const seenPurchaseLines = new Set<string>()
  // A recharged cost with no item still has to post somewhere visible. The same
  // uncategorised income used as the journal fallback is frozen on the line so
  // the invoice shows where the money went without inventing a second default.
  const uncategorisedIncomeId =
    purchaseLineIds.length > 0
      ? await systemAccountId(tx, ctx.orgId, 'UNCATEGORISED_INCOME')
      : null
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
    if (item?.type === 'GROUP' && !item.incomeAccountId) {
      throw precondition(
        `"${item.name}" is a group with no income account. Set the group's sales account before selling it as a kit.`,
      )
    }
    if (line.storeId && !knownStores.has(line.storeId)) throw notFound('Store')

    if (line.sourcePurchaseLineId) {
      if (seenPurchaseLines.has(line.sourcePurchaseLineId)) {
        throw validation('The same billable expense cannot be added twice on one invoice.')
      }
      seenPurchaseLines.add(line.sourcePurchaseLineId)
      const purchaseLine = billableById.get(line.sourcePurchaseLineId)
      if (!purchaseLine) throw notFound('Billable expense')
      const parent = purchaseLine.document
      const posted =
        (parent.type === 'BILL' || parent.type === 'EXPENSE') &&
        !parent.deletedAt &&
        parent.status !== 'VOID' &&
        parent.status !== 'DRAFT' &&
        parent.status !== 'PENDING_APPROVAL'
      if (!posted) {
        throw precondition(`${parent.number} is not a posted bill or expense, so its cost cannot be recharged.`)
      }
      if (!options?.customerId || purchaseLine.billableCustomerId !== options.customerId) {
        throw validation('That cost is not billable to this customer.')
      }
      const already = purchaseLine.billedInvoiceLine
      if (already && already.documentId !== options.excludeDocumentId) {
        throw conflict('That expense has already been pulled onto an invoice.')
      }
    }

    const isDiscount = item?.type === 'DISCOUNT'
    const isSubtotal = item?.type === 'SUBTOTAL'
    const isPayment = item?.type === 'PAYMENT'
    const incomeAccountId = isPayment || isSubtotal
      ? null
      : (item?.incomeAccountId ??
        (line.sourcePurchaseLineId ? uncategorisedIncomeId : null))

    return {
      itemId: line.itemId ?? null,
      storeId: line.storeId ?? null,
      description:
        line.description ?? item?.salesDescription ?? item?.description ?? item?.name ?? null,
      quantity: line.quantity,
      unitPrice: (() => {
        if (line.unitPrice !== '') return line.unitPrice
        let base =
          (item?.id && listPrices.get(item.id)) ||
          (priceLevel === 'WHOLESALE' && item?.wholesalePrice != null
            ? item.wholesalePrice.toString()
            : (item?.salesPrice?.toString() ?? '0'))
        const pct = promoFor(item?.id ?? null)
        if (pct > 0) {
          base = new Decimal(base).times(new Decimal(1).minus(new Decimal(pct).div(100))).toFixed(4)
        }
        return base
      })(),
      discountPercent: line.discountPercent ?? null,
      taxCodeId: ctx.features.enableTax && !isPayment && !isSubtotal
        ? (line.taxCodeId ?? item?.salesTaxCodeId ?? null)
        : null,
      incomeAccountId,
      depositAccountId: isPayment ? (item?.depositAccountId ?? null) : null,
      serviceDate: line.serviceDate ?? null,
      lotNumber: line.lotNumber ?? null,
      serialNumber: line.serialNumber ?? null,
      lotExpiryDate: line.lotExpiryDate ?? null,
      isDiscount,
      isSubtotal,
      isPayment,
      isStock: item?.type === 'INVENTORY' || item?.type === 'INVENTORY_ASSEMBLY',
      sourcePurchaseLineId: line.sourcePurchaseLineId ?? null,
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
