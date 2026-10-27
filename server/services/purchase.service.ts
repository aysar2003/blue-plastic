import 'server-only'
import type { DocumentType, Prisma, PurchaseDocumentType } from '@prisma/client'

import { lineLabel } from '@/lib/purchase-board'
import {
  endOfMonth,
  startOfMonth,
  toCalendarDate,
  toDate,
  today,
  type CalendarDate,
} from '@/lib/date'
import { documentOverdueOr, isCollectionOverdue, overdueClock, partyFromContact } from '@/lib/invoice-overdue'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { dueDateFor } from '@/lib/payment-terms'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import {
  unnamedPurchaseLineIndexes,
  type PurchaseDocumentInput,
  type ReceiveOrderInput,
} from '@/lib/validation/purchases'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { CLEAR_DELETION, restoreSoftDeletedDocument, softDeleteDocument } from '@/server/accounting/deletion'
import { postJournal, reverseJournal } from '@/server/accounting/posting'
import { priceDocument, type DraftSalesLine } from '@/server/accounting/sales-pricing'
import { recordMovement, restoreMovementsFor, reverseMovementsFor } from '@/server/accounting/inventory'
import { purchaseByType } from '@/lib/purchase-types'
import {
  buildBillJournal,
  buildExpenseJournal,
  buildVendorCreditJournal,
  PURCHASE_POSTS_A_JOURNAL,
  type PurchaseJournalInput,
} from '@/server/accounting/builders/purchases'
import type { TaxCodeShape } from '@/server/accounting/tax'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'
import { workbookRecords } from '@/server/services/workbook'
import * as approvalService from '@/server/services/approval.service'
import { resolveProjectId } from '@/server/services/project.service'
import * as storeService from '@/server/services/store.service'
import { loadCodeForCalculation } from '@/server/services/tax.service'

const SEQUENCE_FOR: Record<PurchaseDocumentType, DocumentType> = {
  BILL: 'BILL',
  EXPENSE: 'EXPENSE',
  VENDOR_CREDIT: 'VENDOR_CREDIT',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  PURCHASE_REQUEST: 'PURCHASE_REQUEST',
  RFQ: 'RFQ',
}

/** Non-posting papers that may have no money value yet. */
const ALLOWS_ZERO_TOTAL: ReadonlySet<PurchaseDocumentType> = new Set([
  'PURCHASE_ORDER',
  'PURCHASE_REQUEST',
  'RFQ',
])

/** Papers that keep an expiry / “good until” date like a purchase order. */
const HAS_EXPIRY: ReadonlySet<PurchaseDocumentType> = new Set([
  'PURCHASE_ORDER',
  'PURCHASE_REQUEST',
  'RFQ',
])

const CONVERTIBLE_SOURCES: PurchaseDocumentType[] = ['PURCHASE_REQUEST', 'RFQ']
export const PURCHASE_CONVERT_TARGETS = ['RFQ', 'PURCHASE_ORDER'] as const
export type PurchaseConvertTarget = (typeof PURCHASE_CONVERT_TARGETS)[number]

const DOCUMENT_SELECT = {
  id: true, type: true, number: true, date: true, dueDate: true, expiryDate: true, createdAt: true,
  status: true, reference: true, memo: true,
  subtotal: true, taxTotal: true, total: true,
  currencyCode: true, paymentAccountId: true, offsetCustomerId: true, journalId: true, version: true,
  voidedAt: true, voidReason: true, convertedFromId: true, paymentTermId: true,
  projectId: true,
  project: { select: { id: true, number: true, name: true } },
  vendor: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      balanceDate: true,
      agreementDate: true,
      balanceTime: true,
    },
  },
  offsetCustomer: { select: { id: true, displayName: true, email: true, phone: true } },
  paymentTerm: { select: { id: true, name: true, type: true, dueDays: true } },
  paymentAccount: { select: { id: true, code: true, name: true } },
  convertedTo: { select: { id: true, number: true, type: true } },
} satisfies Prisma.PurchaseDocumentSelect

/** Orderings the list screen offers. Sorting happens here, over every row. */
const PURCHASE_ORDER: Record<
  string,
  (dir: 'asc' | 'desc') => Prisma.PurchaseDocumentOrderByWithRelationInput[]
> = {
  number: (dir) => [{ number: dir }],
  date: (dir) => [{ date: dir }, { number: dir }],
  vendor: (dir) => [{ vendor: { displayName: dir } }, { date: 'desc' }],
  reference: (dir) => [{ reference: dir }, { date: 'desc' }],
  dueDate: (dir) => [{ dueDate: dir }, { number: 'desc' }],
  total: (dir) => [{ total: dir }, { date: 'desc' }],
  status: (dir) => [{ status: dir }, { date: 'desc' }],
}

export async function list(
  ctx: OrgContext,
  type: PurchaseDocumentType,
  query: ListQuery,
  options: {
    status?: string
    vendorId?: string
    ids?: string[]
    sort?: string
    dir?: 'asc' | 'desc'
    from?: CalendarDate
    to?: CalendarDate
  } = {},
) {
  const selected = options.ids?.filter(Boolean) ?? []
  const where: Prisma.PurchaseDocumentWhereInput = {
    orgId: ctx.orgId,
    type,
    ...(selected.length ? { id: { in: selected } } : {}),
    ...(selected.length ? {} : options.vendorId ? { vendorId: options.vendorId } : {}),
    ...(options.status === 'open'
      ? type === 'PURCHASE_ORDER' || type === 'PURCHASE_REQUEST' || type === 'RFQ'
        ? { status: 'OPEN' as const }
        : { status: { in: ['OPEN' as const, 'PARTIAL' as const] } }
      : {}),
    ...(options.status === 'overdue'
      ? (() => {
          const clock = overdueClock(ctx.organization.timeZone)
          return {
            status: { in: ['OPEN' as const, 'PARTIAL' as const] },
            OR: documentOverdueOr({
              asOf: clock.asOfDate,
              nowTime: clock.nowTime,
              party: 'vendor',
            }) as Prisma.PurchaseDocumentWhereInput[],
          }
        })()
      : {}),
    ...(options.status === 'notdue'
      ? (() => {
          const clock = overdueClock(ctx.organization.timeZone)
          return {
            status: { in: ['OPEN' as const, 'PARTIAL' as const] },
            NOT: {
              OR: documentOverdueOr({
                asOf: clock.asOfDate,
                nowTime: clock.nowTime,
                party: 'vendor',
              }) as Prisma.PurchaseDocumentWhereInput[],
            },
          }
        })()
      : {}),
    ...(options.status === 'draft' ? { status: 'DRAFT' } : {}),
    ...(options.status === 'paid' ? { status: 'PAID' } : {}),
    ...(options.status === 'closed' ? { status: 'CLOSED' } : {}),
    ...(options.status === 'partial' ? { status: 'PARTIAL' } : {}),
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
            { vendor: { displayName: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.purchaseDocument.findMany({
      where,
      // Applied payments and credits come back with the row so a list can say
      // what deleting one would release without a second query per row.
      select: {
        ...DOCUMENT_SELECT,
        _count: { select: { applications: true, creditsApplied: true } },
      },
      orderBy:
        (options.sort ? PURCHASE_ORDER[options.sort]?.(options.dir ?? 'asc') : undefined) ??
        [{ date: 'desc' }, { number: 'desc' }],
      ...paginate(query),
    }),
    db.purchaseDocument.count({ where }),
  ])

  const balances = await outstandingBalances(db, rows.map((row) => row.id))

  return paged(
    rows.map((row) => ({
      ...row,
      subtotal: row.subtotal.toString(),
      taxTotal: row.taxTotal.toString(),
      total: row.total.toString(),
      // Only a bill can be owed. An expense was paid on the spot and a purchase
      // order is not a transaction, so both are shown as nothing outstanding
      // rather than as the whole document being due.
      balance:
        row.type === 'BILL'
          ? toMoneyString(balances.get(row.id) ?? new Decimal(row.total.toString()), 2)
          : '0.00',
      appliedCount: row._count.applications + row._count.creditsApplied,
    })),
    total,
    query,
  )
}

/**
 * Purchase orders for the register: the list, plus the category, the store, and
 * how many papers are attached. Class and last-email are not stored, so the
 * screen leaves those cells blank rather than inventing them.
 */
export async function listOrderBoard(
  ctx: OrgContext,
  query: ListQuery,
  options: {
    status?: string
    vendorId?: string
    sort?: string
    dir?: 'asc' | 'desc'
    from?: CalendarDate
    to?: CalendarDate
  } = {},
) {
  const page = await list(ctx, 'PURCHASE_ORDER', query, options)
  const ids = page.rows.map((row) => row.id)
  if (ids.length === 0) {
    return { ...page, rows: page.rows.map((row) => ({ ...row, category: '—', location: '—', attachments: 0 })) }
  }

  const [lines, files] = await Promise.all([
    db.purchaseDocumentLine.findMany({
      where: { documentId: { in: ids } },
      select: {
        documentId: true,
        expenseAccount: { select: { name: true } },
        store: { select: { name: true } },
      },
    }),
    db.ledgerFile.groupBy({
      by: ['purchaseDocumentId'],
      where: { orgId: ctx.orgId, purchaseDocumentId: { in: ids } },
      _count: { _all: true },
    }),
  ])

  const categories = new Map<string, string[]>()
  const locations = new Map<string, string[]>()
  for (const line of lines) {
    const cats = categories.get(line.documentId) ?? []
    if (line.expenseAccount?.name) cats.push(line.expenseAccount.name)
    categories.set(line.documentId, cats)
    const stores = locations.get(line.documentId) ?? []
    if (line.store?.name) stores.push(line.store.name)
    locations.set(line.documentId, stores)
  }
  const attachments = new Map(
    files.map((file) => [file.purchaseDocumentId, file._count._all]),
  )

  return {
    ...page,
    rows: page.rows.map((row) => ({
      ...row,
      category: lineLabel(categories.get(row.id) ?? []),
      location: lineLabel(locations.get(row.id) ?? []),
      attachments: attachments.get(row.id) ?? 0,
    })),
  }
}

/** Names for the vendor filter on a purchase list. */
export async function vendorChoices(ctx: OrgContext) {
  return db.vendor.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
  })
}

export async function get(ctx: OrgContext, id: string) {
  const document = await db.purchaseDocument.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      ...DOCUMENT_SELECT,
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true, lineNumber: true, description: true, quantity: true, unitPrice: true,
          quantityReceived: true, storeId: true,
          discountPercent: true, amount: true, taxAmount: true,
          item: { select: { id: true, name: true, sku: true } },
          taxCode: { select: { id: true, name: true } },
          expenseAccount: { select: { id: true, code: true, name: true } },
        },
      },
      applications: {
        select: {
          id: true, amount: true,
          payment: { select: { id: true, number: true, date: true } },
          creditDocument: { select: { id: true, number: true, date: true } },
        },
      },
      journal: { select: { id: true, journalNumber: true, status: true } },
    },
  })
  if (!document) throw notFound('Document')

  const applied = document.applications.reduce((sum, a) => sum.plus(a.amount.toString()), ZERO)
  const total = new Decimal(document.total.toString())

  return {
    ...document,
    subtotal: document.subtotal.toString(),
    taxTotal: document.taxTotal.toString(),
    total: total.toString(),
    lines: document.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      quantityReceived: line.quantityReceived.toString(),
      // Only meaningful on an order, but computed once here rather than in each
      // screen that wants to show what is still to come.
      quantityRemaining: Decimal.max(
        new Decimal(line.quantity.toString()).minus(line.quantityReceived.toString()),
        0,
      ).toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent?.toString() ?? null,
      amount: line.amount.toString(),
      taxAmount: line.taxAmount.toString(),
    })),
    applications: document.applications.map((a) => ({ ...a, amount: a.amount.toString() })),
    amountApplied: toMoneyString(applied, 2),
    balance: document.type === 'BILL' ? toMoneyString(total.minus(applied), 2) : '0.00',
  }
}

/** The document before and after this one, in date then number order. A new form sits after the last. */
export async function neighbors(ctx: OrgContext, type: PurchaseDocumentType, currentId: string | null) {
  const rows = await db.purchaseDocument.findMany({
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

/**
 * Several bills in full, in the order asked for, for a vendor statement that
 * prints each bill on the invoice sheet.
 */
export async function getMany(ctx: OrgContext, ids: string[]) {
  if (ids.length === 0) return []
  const rows = await db.purchaseDocument.findMany({
    where: { id: { in: ids }, orgId: ctx.orgId },
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      dueDate: true,
      expiryDate: true,
      createdAt: true,
      status: true,
      reference: true,
      memo: true,
      subtotal: true,
      taxTotal: true,
      total: true,
      currencyCode: true,
      createdById: true,
      vendor: {
        select: {
          displayName: true,
          email: true,
          phone: true,
          billingLine1: true,
          billingLine2: true,
          billingCity: true,
          billingRegion: true,
        },
      },
      paymentTerm: { select: { name: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          lineNumber: true,
          description: true,
          quantity: true,
          unitPrice: true,
          discountPercent: true,
          amount: true,
          taxAmount: true,
          item: { select: { name: true, sku: true, unitOfMeasure: true } },
        },
      },
      applications: { select: { amount: true } },
    },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered = ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
  const userIds = [...new Set(ordered.map((row) => row.createdById).filter((id): id is string => Boolean(id)))]
  const users =
    userIds.length === 0
      ? []
      : await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
  const names = new Map(users.map((user) => [user.id, user.name]))

  return ordered.map((document) => {
    const applied = document.applications.reduce((sum, row) => sum.plus(row.amount.toString()), ZERO)
    const total = new Decimal(document.total.toString())
    return {
      id: document.id,
      type: document.type,
      number: document.number,
      date: document.date,
      dueDate: document.dueDate,
      expiryDate: document.expiryDate,
      createdAt: document.createdAt,
      status: document.status,
      reference: document.reference,
      currencyCode: document.currencyCode,
      subtotal: document.subtotal.toString(),
      discountAmount: '0',
      taxTotal: document.taxTotal.toString(),
      total: total.toString(),
      amountApplied: toMoneyString(applied, 2),
      balance: document.type === 'BILL' ? toMoneyString(total.minus(applied), 2) : '0.00',
      customerMessage: document.memo,
      createdByName: document.createdById ? (names.get(document.createdById) ?? null) : null,
      paymentTerm: document.paymentTerm,
      customer: document.vendor ?? {
        displayName: 'No vendor',
        email: null,
        phone: null,
        billingLine1: null,
        billingLine2: null,
        billingCity: null,
        billingRegion: null,
      },
      lines: document.lines.map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        amount: line.amount.toString(),
        discountPercent: line.discountPercent?.toString() ?? null,
        taxAmount: line.taxAmount.toString(),
        item: line.item,
      })),
    }
  })
}

/** What is still owed on each of these bills. Derived, never stored. */
export async function outstandingBalances(
  client: Tx | typeof db,
  documentIds: string[],
): Promise<Map<string, Decimal>> {
  if (documentIds.length === 0) return new Map()

  const rows = await client.$queryRaw<{ id: string; total: string; applied: string }[]>`
    SELECT d.id,
           d.total AS total,
           COALESCE((SELECT SUM(a.amount) FROM purchase_applications a WHERE a."billId" = d.id), 0) AS applied
      FROM purchase_documents d
     WHERE d.id = ANY(${documentIds})
  `

  return new Map(rows.map((row) => [row.id, new Decimal(row.total).minus(row.applied)]))
}

/** Figures for the bills home — same unpaid / overdue / paid split as invoices. */
export async function billHome(ctx: OrgContext) {
  const clock = overdueClock(ctx.organization.timeZone)
  const now = clock.asOf
  const base = {
    orgId: ctx.orgId,
    type: 'BILL' as const,
    deletedAt: null,
  }

  const [draftAgg, paidAgg, openRows] = await Promise.all([
    db.purchaseDocument.aggregate({
      where: { ...base, status: 'DRAFT' },
      _sum: { total: true },
      _count: true,
    }),
    db.purchaseDocument.aggregate({
      where: { ...base, status: 'PAID' },
      _sum: { total: true },
      _count: true,
    }),
    // Only live payables need per-row balances — skip paid/draft history.
    db.purchaseDocument.findMany({
      where: { ...base, status: { in: ['OPEN', 'PARTIAL'] } },
      select: {
        id: true,
        dueDate: true,
        total: true,
        vendor: { select: { balanceDate: true, agreementDate: true, balanceTime: true } },
      },
    }),
  ])

  const balances = await outstandingBalances(
    db,
    openRows.map((row) => row.id),
  )

  let unpaid = ZERO
  let overdue = ZERO
  let notDue = ZERO
  let unpaidCount = 0
  let overdueCount = 0
  let notDueCount = 0

  for (const row of openRows) {
    const owing = balances.get(row.id) ?? new Decimal(row.total.toString())
    unpaid = unpaid.plus(owing)
    unpaidCount += 1
    if (isCollectionOverdue({ ...row, ...partyFromContact(row.vendor) }, now, clock)) {
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
    paid: toMoneyString(paidAgg._sum.total ?? 0, 2),
    paidCount: paidAgg._count,
    draftTotal: toMoneyString(draftAgg._sum.total ?? 0, 2),
    draftCount: draftAgg._count,
  }
}

/** Period totals for the expenses home (paid on the spot). */
export async function expenseHome(ctx: OrgContext) {
  const now = today(ctx.organization.timeZone)
  const year = now.slice(0, 4)
  const base = {
    orgId: ctx.orgId,
    type: 'EXPENSE' as const,
    deletedAt: null,
    status: { not: 'VOID' as const },
  }
  const between = (from: CalendarDate, to: CalendarDate) => ({
    ...base,
    date: { gte: toDate(from), lte: toDate(to) },
  })
  const tally = (where: Prisma.PurchaseDocumentWhereInput) =>
    Promise.all([
      db.purchaseDocument.aggregate({ where, _sum: { total: true } }),
      db.purchaseDocument.count({ where }),
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

/** Open / applied / draft split for vendor credits. */
export async function vendorCreditHome(ctx: OrgContext) {
  const rows = await db.purchaseDocument.findMany({
    where: { orgId: ctx.orgId, type: 'VENDOR_CREDIT', deletedAt: null, status: { not: 'VOID' } },
    select: { status: true, total: true },
  })

  let open = ZERO
  let applied = ZERO
  let draftTotal = ZERO
  let openCount = 0
  let appliedCount = 0
  let draftCount = 0

  for (const row of rows) {
    const amount = new Decimal(row.total.toString())
    if (row.status === 'DRAFT') {
      draftCount += 1
      draftTotal = draftTotal.plus(amount)
      continue
    }
    if (row.status === 'PAID' || row.status === 'CLOSED') {
      appliedCount += 1
      applied = applied.plus(amount)
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
    applied: toMoneyString(applied, 2),
    appliedCount,
    draftTotal: toMoneyString(draftTotal, 2),
    draftCount,
  }
}

/** Open / receiving / closed split for purchase orders. */
export async function purchaseOrderHome(ctx: OrgContext) {
  const rows = await db.purchaseDocument.findMany({
    where: { orgId: ctx.orgId, type: 'PURCHASE_ORDER', deletedAt: null, status: { not: 'VOID' } },
    select: { status: true, total: true },
  })

  let open = ZERO
  let partial = ZERO
  let closed = ZERO
  let draftTotal = ZERO
  let openCount = 0
  let partialCount = 0
  let closedCount = 0
  let draftCount = 0

  for (const row of rows) {
    const amount = new Decimal(row.total.toString())
    if (row.status === 'DRAFT') {
      draftCount += 1
      draftTotal = draftTotal.plus(amount)
      continue
    }
    if (row.status === 'CLOSED') {
      closedCount += 1
      closed = closed.plus(amount)
      continue
    }
    if (row.status === 'PARTIAL') {
      partialCount += 1
      partial = partial.plus(amount)
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
    partial: toMoneyString(partial, 2),
    partialCount,
    closed: toMoneyString(closed, 2),
    closedCount,
    draftTotal: toMoneyString(draftTotal, 2),
    draftCount,
  }
}

export async function create(
  ctx: OrgContext,
  type: PurchaseDocumentType,
  input: PurchaseDocumentInput,
) {
  const meta = await requestMeta()
  return db.$transaction((tx) => createWithin(tx, ctx, type, input, meta))
}

/**
 * The body of `create`, taking the caller's transaction.
 *
 * Split out because two things create a bill as part of a larger act: receiving
 * goods against a purchase order, and converting one outright. Both also have to
 * update the order in the same breath — and when creation opened its own
 * transaction, as it used to, a failure after the bill was written left the bill
 * in the books with the order still showing nothing received. One unit of work
 * or none.
 */
async function createWithin(
  tx: Tx,
  ctx: OrgContext,
  type: PurchaseDocumentType,
  input: PurchaseDocumentInput,
  meta: Awaited<ReturnType<typeof requestMeta>>,
) {
  {
    const { vendor, offsetCustomerId } = await resolvePurchaseParty(tx, ctx, type, input)
    const projectId = await resolveProjectId(tx, ctx, input.projectId)
    const isDraft = input.saveAsDraft === true
    assertNamedPurchaseLines(isDraft, input.lines)
    const lines = await resolveLines(tx, ctx, input.lines, vendor?.defaultExpenseAccountId ?? null)
    const taxCodes = await loadTaxCodes(tx, ctx, lines)
    const priced = priceDocument(lines, taxCodes, ctx.organization.baseCurrency)
    if (priced.total.isZero() && !isDraft && !ALLOWS_ZERO_TOTAL.has(type)) {
      throw validation('A document with no value has nothing to record.')
    }

    const term = input.paymentTermId
      ? await tx.paymentTerm.findFirst({
          where: { id: input.paymentTermId, orgId: ctx.orgId },
          select: { id: true, type: true, dueDays: true },
        })
      : (vendor?.paymentTerm ?? null)

    // An expense is paid at once — from a money account, or against a customer.
    if (type === 'EXPENSE' && !isDraft) {
      await requireExpenseSettlement(tx, ctx, input.paymentAccountId, offsetCustomerId)
    }

    const number = await assignDocumentNumber(tx, ctx.orgId, SEQUENCE_FOR[type], input.number)
    const clash = await tx.purchaseDocument.findFirst({
      where: { orgId: ctx.orgId, type, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    // Bills post to the ledger; purchase orders / PRs / RFQs may wait for approval to open.
    const gate = !isDraft
      ? await approvalService.needsApproval(ctx, 'PURCHASE_DOCUMENT', priced.total, tx, type)
      : { required: false, levels: 1, requireDifferentApprover: true }
    const holdForApproval = gate.required

    const document = await tx.purchaseDocument.create({
      data: {
        orgId: ctx.orgId,
        type,
        number,
        vendorId: vendor?.id ?? null,
        date: toDate(input.date),
        dueDate: type === 'BILL' ? toDate(dueDateFor(input.date, term ?? null)) : null,
        expiryDate: HAS_EXPIRY.has(type) && input.expiryDate ? toDate(input.expiryDate) : null,
        paymentTermId: term?.id ?? null,
        status: isDraft ? 'DRAFT' : holdForApproval ? 'PENDING_APPROVAL' : 'OPEN',
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        subtotal: priced.subtotal.toFixed(4),
        taxTotal: priced.taxTotal.toFixed(4),
        total: priced.total.toFixed(4),
        currencyCode: ctx.organization.baseCurrency,
        paymentAccountId: input.paymentAccountId ?? null,
        offsetCustomerId,
        projectId,
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
            expenseAccountId: line.incomeAccountId,
          })),
        },
      },
      select: { id: true, number: true, total: true, status: true },
    })

    if (holdForApproval) {
      const cfg = purchaseByType(type)
      await approvalService.submitRequest(tx, ctx, {
        entityType: 'PURCHASE_DOCUMENT',
        entityId: document.id,
        title: `${cfg.singular} ${number}`,
        href: `/purchases/${cfg.slug}/${document.id}`,
        amount: document.total,
        currencyCode: ctx.organization.baseCurrency,
        levels: gate.levels,
      })
    } else if (!isDraft && PURCHASE_POSTS_A_JOURNAL[type]) {
      await postDocument(tx, ctx, document.id)
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'PurchaseDocument',
        entityId: document.id,
        action: 'CREATE',
        after: { type, number: document.number, total: document.total.toString() },
      },
      meta,
    )

    return { id: document.id, number: document.number }
  }
}

export async function update(ctx: OrgContext, id: string, input: PurchaseDocumentInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const existing = await tx.purchaseDocument.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, type: true, number: true, status: true, journalId: true, version: true, total: true },
    })
    if (!existing) throw notFound('Document')
    if (existing.status === 'VOID') {
      throw precondition('A voided document cannot be edited. Create a new one.')
    }

    const applied = await appliedTotal(tx, id)
    if (!applied.isZero()) {
      throw precondition(
        `${existing.number} has ${toMoneyString(applied, 2)} applied to it. ` +
          `Remove the payments or credits before changing what it says.`,
      )
    }

    const { vendor, offsetCustomerId } = await resolvePurchaseParty(tx, ctx, existing.type, input)
    const projectId = await resolveProjectId(tx, ctx, input.projectId)

    if (existing.type === 'EXPENSE' && !input.saveAsDraft) {
      await requireExpenseSettlement(tx, ctx, input.paymentAccountId, offsetCustomerId)
    }

    assertNamedPurchaseLines(input.saveAsDraft === true, input.lines)
    const lines = await resolveLines(tx, ctx, input.lines, vendor?.defaultExpenseAccountId ?? null)
    const taxCodes = await loadTaxCodes(tx, ctx, lines)
    const priced = priceDocument(lines, taxCodes, ctx.organization.baseCurrency)

    const term = input.paymentTermId
      ? await tx.paymentTerm.findFirst({
          where: { id: input.paymentTermId, orgId: ctx.orgId },
          select: { id: true, type: true, dueDays: true },
        })
      : (vendor?.paymentTerm ?? null)

    // The old journal comes out before the new one goes in — and so does the
    // stock it received. Reversing only the journal would leave the stock
    // ledger holding goods the general ledger no longer values.
    if (existing.journalId) {
      const reversal = await reverseJournal(tx, ctx, existing.journalId, {
        reason: `${existing.number} edited`,
      })
      await reverseMovementsFor(tx, ctx, { sourceId: id, date: input.date, journalId: reversal.id })
    }

    await tx.purchaseDocumentLine.deleteMany({ where: { documentId: id } })

    const number = await assignDocumentNumber(
      tx,
      ctx.orgId,
      SEQUENCE_FOR[existing.type],
      input.number ?? existing.number,
    )
    const numberClash = await tx.purchaseDocument.findFirst({
      where: { orgId: ctx.orgId, type: existing.type, number, id: { not: id } },
      select: { id: true },
    })
    if (numberClash) throw numberTaken()

    const gate = !input.saveAsDraft
      ? await approvalService.needsApproval(ctx, 'PURCHASE_DOCUMENT', priced.total, tx, existing.type)
      : { required: false, levels: 1, requireDifferentApprover: true }
    const holdForApproval = gate.required

    await tx.purchaseDocument.update({
      where: { id },
      data: {
        number,
        vendorId: vendor?.id ?? null,
        date: toDate(input.date),
        dueDate: existing.type === 'BILL' ? toDate(dueDateFor(input.date, term ?? null)) : null,
        // A purchase order's expiry survives an edit. It used to be silently
        // dropped, so editing an order threw away the date it was good until.
        expiryDate:
          HAS_EXPIRY.has(existing.type) && input.expiryDate ? toDate(input.expiryDate) : null,
        paymentTermId: term?.id ?? null,
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        subtotal: priced.subtotal.toFixed(4),
        taxTotal: priced.taxTotal.toFixed(4),
        total: priced.total.toFixed(4),
        paymentAccountId: input.paymentAccountId ?? null,
        offsetCustomerId,
        projectId,
        journalId: null,
        version: { increment: 1 },
        status: input.saveAsDraft ? 'DRAFT' : holdForApproval ? 'PENDING_APPROVAL' : 'OPEN',
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
            expenseAccountId: line.incomeAccountId,
          })),
        },
      },
    })

    if (holdForApproval) {
      const cfg = purchaseByType(existing.type)
      await approvalService.submitRequest(tx, ctx, {
        entityType: 'PURCHASE_DOCUMENT',
        entityId: id,
        title: `${cfg.singular} ${number}`,
        href: `/purchases/${cfg.slug}/${id}`,
        amount: priced.total,
        currencyCode: ctx.organization.baseCurrency,
        levels: gate.levels,
      })
    } else if (!input.saveAsDraft && PURCHASE_POSTS_A_JOURNAL[existing.type]) {
      await postDocument(tx, ctx, id)
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'PurchaseDocument',
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

export async function postDocument(tx: Tx, ctx: OrgContext, id: string) {
  const document = await tx.purchaseDocument.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true, type: true, number: true, date: true, memo: true, vendorId: true,
      status: true, paymentAccountId: true, offsetCustomerId: true, journalId: true,
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true, amount: true, taxAmount: true, taxCodeId: true, expenseAccountId: true,
          description: true, quantity: true, unitPrice: true, discountPercent: true, itemId: true, storeId: true,
          item: { select: { id: true, name: true, type: true, inventoryAccountId: true } },
        },
      },
    },
  })
  if (!document) throw notFound('Document')
  // Purchase orders have no journal — approval only opens them for receiving.
  if (!PURCHASE_POSTS_A_JOURNAL[document.type]) {
    if (document.status === 'PENDING_APPROVAL') {
      await tx.purchaseDocument.update({
        where: { id: document.id },
        data: { status: 'OPEN' },
      })
    }
    return null
  }
  if (document.journalId) throw conflict(`${document.number} is already posted.`)

  for (const line of document.lines) {
    const type = line.item?.type
    if (type === 'GROUP' || type === 'DISCOUNT' || type === 'SUBTOTAL' || type === 'PAYMENT') {
      throw validation(
        `"${line.item!.name}" is a sales form item and cannot be bought on a bill or expense.`,
        { lines: ['Choose inventory, a service, a non-inventory part, or another charge'] },
      )
    }
  }

  const taxCodes = await loadTaxCodes(
    tx,
    ctx,
    document.lines.map((line) => ({ taxCodeId: line.taxCodeId })),
  )

  const needsCogs = document.lines.some((line) => line.item?.type === 'NON_INVENTORY')
  const systemCogsAccountId = needsCogs ? await systemAccountId(tx, ctx.orgId, 'COGS') : null

  const priced = priceDocument(
    document.lines.map((line) => {
      const stocked = line.item?.type === 'INVENTORY' || line.item?.type === 'INVENTORY_ASSEMBLY'
      return {
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        discountPercent: line.discountPercent?.toString() ?? null,
        taxCodeId: line.taxCodeId,
        // Tracked stock is priced but not expensed: its cost is added to the
        // inventory asset below instead. Non-inventory goods go to COGS.
        incomeAccountId: stocked
          ? null
          : line.item?.type === 'NON_INVENTORY'
            ? systemCogsAccountId
            : line.expenseAccountId,
        isStock: stocked,
      }
    }),
    taxCodes,
    ctx.organization.baseCurrency,
  )

  if (!document.vendorId) {
    throw precondition(`${document.number} needs a vendor before it can be posted.`)
  }

  const input: PurchaseJournalInput = {
    date: toCalendarDate(document.date),
    number: document.number,
    documentId: document.id,
    vendorId: document.vendorId,
    priced,
    payableAccountId: await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_PAYABLE'),
    paymentAccountId: document.paymentAccountId,
    offsetCustomerId: document.offsetCustomerId,
    receivableAccountId: document.offsetCustomerId
      ? await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_RECEIVABLE')
      : null,
    fallbackExpenseAccountId: await systemAccountId(tx, ctx.orgId, 'UNCATEGORISED_EXPENSE'),
    memo: document.memo,
  }

  // Receiving tracked stock values it and adds it to the inventory asset, in the
  // same journal as the payable. Buying stock is not spending: the business has
  // swapped cash for goods, and the expense arrives when they are sold.
  const receivesStock = document.type === 'BILL' || document.type === 'EXPENSE'
  const returnsStock = document.type === 'VENDOR_CREDIT'

  if (receivesStock || returnsStock) {
    const stock = new Map<string, Decimal>()
    let documentStockNet = new Decimal(0)
    const storeAccounts = await storeService.accountsFor(
      tx,
      ctx.orgId,
      document.lines.map((line) => line.storeId),
    )

    for (const [index, line] of document.lines.entries()) {
      if (line.item?.type !== 'INVENTORY' && line.item?.type !== 'INVENTORY_ASSEMBLY') continue
      if (!line.item.inventoryAccountId) {
        throw precondition(`"${line.item.name}" has no inventory account.`)
      }

      const inventoryAccountId =
        (line.storeId && storeAccounts.get(line.storeId)) || line.item.inventoryAccountId
      const quantity = new Decimal(line.quantity.toString())
      // Matched by position, not by item. `priceDocument` returns its lines in
      // the order it was given them, and a document may legitimately carry the
      // same item twice — at two costs, or on two delivery dates. Looking the
      // price up by item id costed both of those lines at the first one's
      // amount, so the second was received into stock at the wrong value.
      const priceForLine = priced.lines[index]
      const netAmount = priceForLine?.amount ?? new Decimal(line.amount.toString())
      const unitCost = quantity.isZero() ? new Decimal(0) : netAmount.dividedBy(quantity)
      documentStockNet = documentStockNet.plus(netAmount)

      const movement = await recordMovement(tx, ctx, {
        itemId: line.item.id,
        date: toCalendarDate(document.date),
        type: receivesStock ? 'PURCHASE' : 'PURCHASE_RETURN',
        sourceType: document.type as never,
        sourceId: document.id,
        sourceLineId: line.id,
        quantity: receivesStock ? quantity : quantity.negated(),
        unitCost: receivesStock ? unitCost : undefined,
        storeId: line.storeId,
      })

      stock.set(
        inventoryAccountId,
        (stock.get(inventoryAccountId) ?? new Decimal(0)).plus(movement.value.abs()),
      )
    }

    input.stock = [...stock.entries()].map(([inventoryAccountId, amount]) => ({
      inventoryAccountId,
      amount,
    }))

    // Returns leave at average cost; the credit is at the document price. The
    // gap has to be posted or payables and inventory will not balance.
    if (returnsStock) {
      const stockAtBookCost = [...stock.values()].reduce(
        (sum, amount) => sum.plus(amount),
        new Decimal(0),
      )
      input.stockCostDifference = stockAtBookCost.minus(documentStockNet)
    }

  }

  const draft =
    document.type === 'BILL'
      ? buildBillJournal(input)
      : document.type === 'EXPENSE'
        ? buildExpenseJournal(input)
        : buildVendorCreditJournal(input)

  const journal = await postJournal(tx, ctx, draft)

  await tx.inventoryTransaction.updateMany({
    where: { orgId: ctx.orgId, sourceId: document.id, journalId: null },
    data: { journalId: journal.id },
  })

  await tx.purchaseDocument.update({
    where: { id },
    data: { journalId: journal.id, status: 'OPEN' },
  })

  await refreshStatus(tx, id)
  return journal
}


/**
 * Delete a purchase document.
 *
 * One verb, whatever state it is in. A bill is withdrawn with the journal it
 * posted and the stock it received; payments applied to it are released and
 * become unapplied money against the vendor. A bill raised by receiving against a
 * purchase order puts what it received back on the order, so the order re-opens
 * with the right quantity still to come — a delivery deleted is a delivery that
 * did not happen.
 *
 * Nothing is physically removed. See `server/accounting/deletion.ts`.
 */
export async function remove(ctx: OrgContext, id: string, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const document = await tx.purchaseDocument.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: {
        id: true, type: true, number: true, status: true, journalId: true, total: true,
        deletedAt: true, convertedFromId: true,
        applications: { select: { id: true, billId: true } },
        creditsApplied: { select: { id: true, billId: true } },
        lines: { select: { id: true, itemId: true, quantity: true } },
      },
    })
    if (!document) throw notFound('Document')
    if (document.deletedAt) return { id, number: document.number }

    const applications = [...document.applications, ...document.creditsApplied]
    const touchedBillIds = [
      ...new Set(applications.map((application) => application.billId).filter((v) => v !== id)),
    ]

    if (applications.length > 0) {
      await tx.purchaseApplication.deleteMany({
        where: { id: { in: applications.map((application) => application.id) } },
      })
    }

    // A bill raised by receiving hands its quantities back to the order.
    if (document.convertedFromId) {
      await restoreOrderQuantities(tx, ctx, document.convertedFromId, id)
    }

    // A purchase order that has bills against it loses the link; the bills stay,
    // because they are the record of goods actually received and money owed.
    await tx.purchaseDocument.updateMany({
      where: { orgId: ctx.orgId, convertedFromId: id },
      data: { convertedFromId: null },
    })

    // Stock received goes back out. See the note in `sales.service.remove`.
    await reverseMovementsFor(tx, ctx, { sourceId: id })

    await softDeleteDocument(tx, ctx, {
      mark: (stamp) => tx.purchaseDocument.update({ where: { id }, data: stamp }),
      entity: 'PurchaseDocument',
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

    for (const billId of touchedBillIds) {
      await refreshStatus(tx, billId)
    }

    return { id, number: document.number }
  })
}

/**
 * Put a deleted purchase document back into the working books.
 *
 * Applications released on delete are not rebuilt — bills return unpaid for the
 * user to settle again. Stock and purchase-order received counts are put back.
 */
export async function restore(ctx: OrgContext, id: string) {
  return db.$transaction(async (tx) => {
    const document = await tx.purchaseDocument.findFirst({
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
      return { id, number: document.number, href: purchaseHref(document.type, document.id) }
    }

    if (document.journalId) {
      await restoreMovementsFor(tx, ctx, { sourceId: id, journalId: document.journalId })
    }

    if (document.convertedFromId) {
      await applyOrderQuantities(tx, ctx, document.convertedFromId, id)
    }

    await restoreSoftDeletedDocument(tx, ctx, {
      clear: () => tx.purchaseDocument.update({ where: { id }, data: CLEAR_DELETION }),
      entity: 'PurchaseDocument',
      id,
      number: document.number,
      journalIds: [document.journalId],
      before: { type: document.type },
    })

    return { id, number: document.number, href: purchaseHref(document.type, document.id) }
  })
}

function purchaseHref(type: PurchaseDocumentType, id: string) {
  return `/purchases/${purchaseByType(type).slug}/${id}`
}

/**
 * Put a deleted receipt's quantities back on the order it was received against.
 *
 * The order's count is the only thing in the system that would otherwise be left
 * stating something untrue: it would still say ten arrived when the bill saying
 * so has been withdrawn. The status follows the count back — an order with
 * nothing received is open again, not closed.
 */
async function restoreOrderQuantities(
  tx: Tx,
  ctx: OrgContext,
  orderId: string,
  billId: string,
): Promise<void> {
  const [order, bill] = await Promise.all([
    tx.purchaseDocument.findFirst({
      where: { id: orderId, orgId: ctx.orgId, type: 'PURCHASE_ORDER' },
      select: {
        id: true, status: true,
        lines: { select: { id: true, itemId: true, description: true, quantity: true, quantityReceived: true } },
      },
    }),
    tx.purchaseDocument.findFirst({
      where: { id: billId, orgId: ctx.orgId },
      select: { lines: { select: { itemId: true, description: true, quantity: true } } },
    }),
  ])
  if (!order || !bill) return

  // Receipt lines are copied from the order's, so they match on what identifies
  // a line: the item, or the description where there is no item.
  const remainingByKey = new Map<string, Decimal>()
  for (const line of bill.lines) {
    const key = line.itemId ?? `text:${line.description ?? ''}`
    remainingByKey.set(
      key,
      (remainingByKey.get(key) ?? ZERO).plus(new Decimal(line.quantity.toString())),
    )
  }

  for (const line of order.lines) {
    const key = line.itemId ?? `text:${line.description ?? ''}`
    const giveBack = remainingByKey.get(key)
    if (!giveBack || giveBack.isZero()) continue

    const received = new Decimal(line.quantityReceived.toString())
    const restored = Decimal.max(received.minus(giveBack), 0)

    await tx.purchaseDocumentLine.update({
      where: { id: line.id },
      data: { quantityReceived: restored.toFixed(4) },
    })

    remainingByKey.set(key, ZERO)
  }

  const refreshed = await tx.purchaseDocumentLine.findMany({
    where: { documentId: orderId },
    select: { quantity: true, quantityReceived: true },
  })

  const outstanding = refreshed.reduce(
    (total, line) =>
      total.plus(
        Decimal.max(
          new Decimal(line.quantity.toString()).minus(line.quantityReceived.toString()),
          0,
        ),
      ),
    ZERO,
  )

  const anyReceived = refreshed.some((line) => !new Decimal(line.quantityReceived.toString()).isZero())

  if (order.status !== 'VOID' && order.status !== 'DRAFT') {
    await tx.purchaseDocument.update({
      where: { id: orderId },
      data: { status: outstanding.isZero() ? 'CLOSED' : anyReceived ? 'PARTIAL' : 'OPEN' },
    })
  }
}

/** Put received quantities back on the order when a deleted bill is restored. */
async function applyOrderQuantities(
  tx: Tx,
  ctx: OrgContext,
  orderId: string,
  billId: string,
): Promise<void> {
  const [order, bill] = await Promise.all([
    tx.purchaseDocument.findFirst({
      where: { id: orderId, orgId: ctx.orgId, type: 'PURCHASE_ORDER' },
      select: {
        id: true,
        status: true,
        lines: {
          select: { id: true, itemId: true, description: true, quantity: true, quantityReceived: true },
        },
      },
    }),
    tx.purchaseDocument.findFirst({
      where: { id: billId, orgId: ctx.orgId, deletedAt: undefined },
      select: { lines: { select: { itemId: true, description: true, quantity: true } } },
    }),
  ])
  if (!order || !bill) return

  const remainingByKey = new Map<string, Decimal>()
  for (const line of bill.lines) {
    const key = line.itemId ?? `text:${line.description ?? ''}`
    remainingByKey.set(
      key,
      (remainingByKey.get(key) ?? ZERO).plus(new Decimal(line.quantity.toString())),
    )
  }

  for (const line of order.lines) {
    const key = line.itemId ?? `text:${line.description ?? ''}`
    const addBack = remainingByKey.get(key)
    if (!addBack || addBack.isZero()) continue

    const received = new Decimal(line.quantityReceived.toString())
    const ordered = new Decimal(line.quantity.toString())
    const next = Decimal.min(received.plus(addBack), ordered)

    await tx.purchaseDocumentLine.update({
      where: { id: line.id },
      data: { quantityReceived: next.toFixed(4) },
    })

    remainingByKey.set(key, ZERO)
  }

  const refreshed = await tx.purchaseDocumentLine.findMany({
    where: { documentId: orderId },
    select: { quantity: true, quantityReceived: true },
  })

  const outstanding = refreshed.reduce(
    (total, line) =>
      total.plus(
        Decimal.max(
          new Decimal(line.quantity.toString()).minus(line.quantityReceived.toString()),
          0,
        ),
      ),
    ZERO,
  )

  const anyReceived = refreshed.some((line) => !new Decimal(line.quantityReceived.toString()).isZero())

  if (order.status !== 'VOID' && order.status !== 'DRAFT') {
    await tx.purchaseDocument.update({
      where: { id: orderId },
      data: { status: outstanding.isZero() ? 'CLOSED' : anyReceived ? 'PARTIAL' : 'OPEN' },
    })
  }
}

/**
 * What is on an order, what has arrived, and what is still to come.
 *
 * The receiving screen is built from this and nothing else, so what it shows and
 * what the service will accept cannot drift apart.
 */
export type ReceivableLine = {
  lineId: string
  lineNumber: number
  itemId: string | null
  itemName: string | null
  sku: string | null
  unitOfMeasure: string | null
  isTracked: boolean
  /** Store named on the purchase order line — the planned shelf, not a lock. */
  storeId: string | null
  description: string | null
  unitPrice: string
  ordered: string
  received: string
  remaining: string
}

export async function receivableOrder(
  ctx: OrgContext,
  orderId: string,
  options: { client?: Tx } = {},
) {
  const client = options.client ?? db
  const order = await client.purchaseDocument.findFirst({
    where: { id: orderId, orgId: ctx.orgId, type: 'PURCHASE_ORDER' },
    select: {
      id: true, number: true, status: true, date: true, reference: true, memo: true,
      vendor: { select: { id: true, displayName: true } },
      convertedTo: {
        select: { id: true, number: true, date: true, status: true },
        orderBy: { date: 'asc' },
      },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true, lineNumber: true, itemId: true, storeId: true, description: true,
          quantity: true, quantityReceived: true, unitPrice: true,
          item: { select: { name: true, sku: true, type: true, unitOfMeasure: true } },
        },
      },
    },
  })
  if (!order) throw notFound('Purchase order')

  const lines: ReceivableLine[] = order.lines.map((line) => {
    const ordered = new Decimal(line.quantity.toString())
    const received = new Decimal(line.quantityReceived.toString())
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
      received: received.toFixed(2),
      // Over-receipt is refused, so nothing outstanding is ever negative even if
      // an earlier bill was voided by hand.
      remaining: Decimal.max(ordered.minus(received), 0).toFixed(2),
    }
  })

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    date: order.date,
    reference: order.reference,
    memo: order.memo,
    vendor: order.vendor,
    receipts: order.convertedTo,
    lines,
    fullyReceived: lines.every((line) => new Decimal(line.remaining).isZero()),
  }
}

/**
 * Receive goods against a purchase order.
 *
 * An order is rarely filled in one delivery, and this used to be all or nothing:
 * one button that turned the whole order into a bill for everything on it,
 * whether or not it had all turned up. If half arrived, the choice was to bill
 * for goods that were not there — inflating stock and the payables balance — or
 * to record nothing at all until the rest came. Both are wrong, and the second
 * is what people did.
 *
 * So a receipt is a quantity per line. It raises a bill for exactly what arrived,
 * which is what moves stock and raises the payable; the order keeps count of what
 * it is still owed and closes itself when nothing is left. Receiving the balance
 * later is the same act again.
 *
 * The bill is the accounting document — this is not a second ledger. All the
 * order carries is the count, and the receiving service is its only writer.
 */
export async function receiveOrder(ctx: OrgContext, input: ReceiveOrderInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const order = await tx.purchaseDocument.findFirst({
      where: { id: input.orderId, orgId: ctx.orgId, type: 'PURCHASE_ORDER' },
      select: {
        id: true, number: true, status: true, vendorId: true, reference: true, memo: true,
        paymentTermId: true, projectId: true,
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            id: true, lineNumber: true, itemId: true, storeId: true, description: true,
            quantity: true, quantityReceived: true, unitPrice: true,
            discountPercent: true, taxCodeId: true, expenseAccountId: true,
          },
        },
      },
    })
    if (!order) throw notFound('Purchase order')
    if (!order.vendorId) {
      throw precondition(`${order.number} has no vendor and cannot be received.`)
    }

    if (order.status === 'VOID') {
      throw precondition(`${order.number} is void and cannot be received.`)
    }
    if (order.status === 'DRAFT') {
      throw precondition(
        `${order.number} is still a draft. Save it as an order before receiving against it.`,
      )
    }
    if (order.status === 'CLOSED') {
      throw conflict(`${order.number} is closed — everything on it has already been received.`)
    }

    const byId = new Map(order.lines.map((line) => [line.id, line]))
    const receiving = new Map<string, { quantity: Decimal; storeId: string | null }>()

    for (const request of input.lines) {
      const line = byId.get(request.lineId)
      if (!line) throw notFound('Order line')

      const quantity = new Decimal(request.quantity)
      if (quantity.isZero()) continue
      if (quantity.isNegative()) {
        throw validation(
          'A received quantity cannot be negative. To send goods back, raise a vendor credit.',
        )
      }

      const remaining = new Decimal(line.quantity.toString()).minus(
        line.quantityReceived.toString(),
      )
      if (quantity.greaterThan(remaining)) {
        throw validation(
          `Line ${line.lineNumber} has ${remaining.toFixed(2)} still to come and you have entered ` +
            `${quantity.toFixed(2)}. Receive what arrived; if the vendor sent more than was ordered, ` +
            `amend the order first so the paperwork matches the delivery.`,
          { [`lines.${line.lineNumber}.quantity`]: [`At most ${remaining.toFixed(2)}`] },
        )
      }

      // Per line: this receipt may put item A in one store and item B in another.
      receiving.set(line.id, {
        quantity,
        storeId: request.storeId ?? line.storeId,
      })
    }

    if (receiving.size === 0) {
      throw validation('Enter a quantity against at least one line.')
    }

    const receiveStoreIds = [
      ...new Set(
        [...receiving.values()]
          .map((entry) => entry.storeId)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    if (receiveStoreIds.length > 0) {
      const known = new Set(
        (
          await tx.store.findMany({
            where: { orgId: ctx.orgId, isActive: true, id: { in: receiveStoreIds } },
            select: { id: true },
          })
        ).map((store) => store.id),
      )
      for (const storeId of receiveStoreIds) {
        if (!known.has(storeId)) throw notFound('Store')
      }
    }

    const bill = await createWithin(
      tx,
      ctx,
      'BILL',
      {
        vendorId: order.vendorId,
        date: input.date,
        reference: input.reference ?? order.reference,
        memo:
          input.memo ??
          [`Received against ${order.number}`, order.memo].filter(Boolean).join(' — '),
        paymentTermId: order.paymentTermId,
        projectId: order.projectId,
        lines: order.lines
          .filter((line) => receiving.has(line.id))
          .map((line) => {
            const entry = receiving.get(line.id)!
            return {
              itemId: line.itemId,
              storeId: entry.storeId,
              expenseAccountId: line.expenseAccountId,
              description: line.description,
              quantity: entry.quantity.toString(),
              unitPrice: line.unitPrice.toString(),
              discountPercent: line.discountPercent?.toString() ?? null,
              taxCodeId: line.taxCodeId,
            }
          }),
      } as PurchaseDocumentInput,
      meta,
    )

    await tx.purchaseDocument.update({
      where: { id: bill.id },
      data: { convertedFromId: order.id },
    })

    for (const [lineId, entry] of receiving) {
      await tx.purchaseDocumentLine.update({
        where: { id: lineId },
        data: { quantityReceived: { increment: entry.quantity.toFixed(4) } },
      })
    }

    // Closed once nothing is outstanding; otherwise it stays open, showing what
    // is still owed rather than disappearing off the list of live orders.
    const outstanding = order.lines.reduce((total, line) => {
      const received = new Decimal(line.quantityReceived.toString()).plus(
        receiving.get(line.id)?.quantity ?? 0,
      )
      return total.plus(Decimal.max(new Decimal(line.quantity.toString()).minus(received), 0))
    }, new Decimal(0))

    const status = outstanding.isZero() ? 'CLOSED' : 'PARTIAL'
    await tx.purchaseDocument.update({ where: { id: order.id }, data: { status } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'PurchaseDocument',
        entityId: order.id,
        action: 'UPDATE',
        after: {
          received: bill.number,
          lines: receiving.size,
          status,
          outstanding: outstanding.toFixed(2),
        },
      },
      meta,
    )

    return { ...bill, orderNumber: order.number, orderStatus: status }
  })
}

/**
 * Receive everything still outstanding in one go.
 *
 * The old "receive and bill" button, kept because most orders do arrive in one
 * delivery and making that case take a form is a tax on the common path.
 */
export async function convertOrder(ctx: OrgContext, orderId: string, date: CalendarDate) {
  const order = await receivableOrder(ctx, orderId)

  return receiveOrder(ctx, {
    orderId,
    date,
    lines: order.lines
      .filter((line) => !new Decimal(line.remaining).isZero())
      .map((line) => ({ lineId: line.lineId, quantity: line.remaining })),
  })
}

/**
 * Turn a purchase request into an RFQ, or an RFQ into a purchase order.
 *
 * Mirrors sales convert: source stays readable and is CLOSED; the new document
 * points back via convertedFromId. Receiving a PO into bills stays on
 * receiveOrder / convertOrder.
 */
export async function convertPurchaseDocument(
  ctx: OrgContext,
  sourceId: string,
  date: CalendarDate,
  target: PurchaseConvertTarget,
  vendorId?: string | null,
) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const source = await tx.purchaseDocument.findFirst({
      where: { id: sourceId, orgId: ctx.orgId, type: { in: CONVERTIBLE_SOURCES } },
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        vendorId: true,
        projectId: true,
        reference: true,
        memo: true,
        paymentTermId: true,
        convertedTo: {
          where: { type: { in: ['RFQ', 'PURCHASE_ORDER'] }, deletedAt: null },
          select: { number: true, type: true },
          take: 1,
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            itemId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            discountPercent: true,
            taxCodeId: true,
            expenseAccountId: true,
            storeId: true,
          },
        },
      },
    })
    if (!source) throw notFound('Document')
    if (source.convertedTo.length > 0) {
      const prior = source.convertedTo[0]!
      throw conflict(`${source.number} has already become ${prior.number}.`)
    }
    if (source.status === 'VOID' || source.status === 'CLOSED' || source.status === 'DRAFT') {
      throw precondition(
        `${source.number} is ${source.status.toLowerCase()} and cannot be converted.`,
      )
    }
    if (source.status === 'PENDING_APPROVAL') {
      throw precondition(`${source.number} is waiting for approval and cannot be converted yet.`)
    }
    if (source.type === 'PURCHASE_REQUEST' && target !== 'RFQ' && target !== 'PURCHASE_ORDER') {
      throw precondition('A purchase request becomes an RFQ or a purchase order.')
    }
    if (source.type === 'RFQ' && target !== 'PURCHASE_ORDER') {
      throw precondition('An RFQ becomes a purchase order.')
    }
    if (source.type === target) {
      throw precondition(`${source.number} is already that kind of document.`)
    }

    const resolvedVendorId = vendorId ?? source.vendorId
    if (!resolvedVendorId) {
      throw validation('Choose a vendor.', { vendorId: ['Choose a vendor'] })
    }

    const created = await createWithin(
      tx,
      ctx,
      target,
      {
        vendorId: resolvedVendorId,
        date,
        reference: source.reference,
        memo: source.memo,
        paymentTermId: source.paymentTermId,
        projectId: source.projectId,
        saveAsDraft: false,
        lines: source.lines.map((line) => ({
          itemId: line.itemId,
          expenseAccountId: line.expenseAccountId,
          storeId: line.storeId,
          description: line.description,
          quantity: line.quantity.toString(),
          unitPrice: line.unitPrice.toString(),
          discountPercent: line.discountPercent?.toString() ?? null,
          taxCodeId: line.taxCodeId,
        })),
      } as PurchaseDocumentInput,
      meta,
    )

    await tx.purchaseDocument.update({
      where: { id: created.id },
      data: { convertedFromId: sourceId },
    })
    await tx.purchaseDocument.update({
      where: { id: sourceId },
      data: { status: 'CLOSED' },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'PurchaseDocument',
        entityId: sourceId,
        action: 'UPDATE',
        after: { convertedTo: created.number, fulfilledAs: target },
      },
      meta,
    )

    return { ...created, type: target }
  })
}

/**
 * Recompute a document's status from what has actually settled it.
 *
 * A bill runs OPEN -> PARTIAL -> PAID as payments and credits are applied. An
 * **expense** never becomes a payable at all: the money left the account the
 * moment it was entered, so it is PAID as soon as it is posted. Leaving it OPEN
 * — which is what it used to do — put a settled purchase on every "unpaid" list
 * and made the expense screen read as if the business owed money it had already
 * handed over.
 */
export async function refreshStatus(tx: Tx, documentId: string) {
  const document = await tx.purchaseDocument.findUnique({
    where: { id: documentId },
    select: { id: true, type: true, total: true, status: true, journalId: true },
  })
  if (!document) return
  if (document.status === 'VOID' || document.status === 'DRAFT') return

  if (document.type === 'EXPENSE') {
    if (document.journalId && document.status !== 'PAID') {
      await tx.purchaseDocument.update({ where: { id: documentId }, data: { status: 'PAID' } })
    }
    return
  }

  if (document.type !== 'BILL') return

  const applied = await appliedTotal(tx, documentId)
  const total = new Decimal(document.total.toString())

  const status = applied.greaterThanOrEqualTo(total)
    ? 'PAID'
    : applied.greaterThan(0)
      ? 'PARTIAL'
      : 'OPEN'

  if (status !== document.status) {
    await tx.purchaseDocument.update({ where: { id: documentId }, data: { status } })
  }
}

/* --- Helpers -------------------------------------------------------------- */

async function appliedTotal(tx: Tx, documentId: string): Promise<Decimal> {
  const result = await tx.purchaseApplication.aggregate({
    where: { billId: documentId },
    _sum: { amount: true },
  })
  return new Decimal(result._sum.amount?.toString() ?? '0')
}

/**
 * The account an expense was paid from.
 *
 * Required when the expense is not settled on a customer balance. Any
 * balance-sheet account is allowed: a business pays for things out of petty
 * cash and director's loans as well as out of the bank. Income and expense
 * accounts are refused, since money cannot leave one.
 */
async function requirePaymentAccount(tx: Tx, ctx: OrgContext, accountId: string | null | undefined) {
  if (!accountId) {
    throw validation('Say which account this was paid from.', {
      paymentAccountId: ['Choose the account the money left'],
    })
  }

  const account = await tx.ledgerAccount.findFirst({
    where: { id: accountId, orgId: ctx.orgId },
    select: { id: true, name: true, type: true, isActive: true },
  })
  if (!account) throw notFound('Payment account')

  if (!account.isActive) {
    throw validation(`"${account.name}" is archived, so money cannot be paid out of it.`, {
      paymentAccountId: ['Choose an active account'],
    })
  }

  if (account.type !== 'ASSET' && account.type !== 'LIABILITY') {
    throw validation(
      `"${account.name}" is an ${account.type.toLowerCase()} account, so money cannot be paid out of it.`,
      { paymentAccountId: ['Choose a bank, cash, credit card or other balance-sheet account'] },
    )
  }

  return account
}

async function requireExpenseSettlement(
  tx: Tx,
  ctx: OrgContext,
  paymentAccountId: string | null | undefined,
  offsetCustomerId: string | null,
) {
  if (offsetCustomerId) {
    if (paymentAccountId) await requirePaymentAccount(tx, ctx, paymentAccountId)
    return
  }
  await requirePaymentAccount(tx, ctx, paymentAccountId)
}

async function requireVendor(tx: Tx, ctx: OrgContext, vendorId: string) {
  const vendor = await tx.vendor.findFirst({
    where: { id: vendorId, orgId: ctx.orgId },
    select: {
      id: true,
      isActive: true,
      displayName: true,
      defaultExpenseAccountId: true,
      paymentTerm: { select: { id: true, type: true, dueDays: true } },
    },
  })
  if (!vendor) throw notFound('Vendor')
  if (!vendor.isActive) {
    throw precondition(`${vendor.displayName} is archived. Restore them before entering a bill.`)
  }
  return vendor
}

async function requireCustomer(tx: Tx, ctx: OrgContext, customerId: string) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, orgId: ctx.orgId },
    select: {
      id: true,
      isActive: true,
      displayName: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      mobile: true,
      taxRegistrationNumber: true,
      billingLine1: true,
      billingLine2: true,
      billingCity: true,
      billingRegion: true,
      billingPostalCode: true,
      billingCountry: true,
      paymentTermId: true,
      linkedVendorId: true,
    },
  })
  if (!customer) throw notFound('Customer')
  if (!customer.isActive) {
    throw precondition(`${customer.displayName} is archived. Restore them before settling an expense.`)
  }
  return customer
}

/**
 * Who the purchase is with.
 *
 * Bills, RFQs and orders need a vendor. A purchase request may omit one (internal
 * ask). An expense settled on a customer balance may omit the vendor: a matching
 * vendor row is found or created from that customer so lists and printouts still
 * have a name, while the journal credits AR.
 */
async function resolvePurchaseParty(
  tx: Tx,
  ctx: OrgContext,
  type: PurchaseDocumentType,
  input: PurchaseDocumentInput,
) {
  const offsetCustomerId =
    type === 'EXPENSE' && input.offsetCustomerId ? input.offsetCustomerId : null

  if (offsetCustomerId) {
    await requireCustomer(tx, ctx, offsetCustomerId)
    if (input.vendorId) {
      return { vendor: await requireVendor(tx, ctx, input.vendorId), offsetCustomerId }
    }
    return {
      vendor: await ensureVendorForCustomer(tx, ctx, offsetCustomerId),
      offsetCustomerId,
    }
  }

  if (!input.vendorId) {
    if (type === 'PURCHASE_REQUEST') {
      return { vendor: null, offsetCustomerId: null }
    }
    throw validation('Choose a vendor.', { vendorId: ['Choose a vendor'] })
  }
  return { vendor: await requireVendor(tx, ctx, input.vendorId), offsetCustomerId: null }
}

/**
 * Reuse a vendor with the same display name as the customer, or create one.
 * Keeps the purchase document's required vendor link without forcing a second
 * contact to be typed when buying from a customer's shop.
 */
async function ensureVendorForCustomer(tx: Tx, ctx: OrgContext, customerId: string) {
  const customer = await requireCustomer(tx, ctx, customerId)

  const vendorSelect = {
    id: true,
    isActive: true,
    displayName: true,
    defaultExpenseAccountId: true,
    paymentTerm: { select: { id: true, type: true, dueDays: true } },
  } as const

  // Prefer an explicit customer ↔ supplier link over a same-name match.
  if (customer.linkedVendorId) {
    const linked = await tx.vendor.findFirst({
      where: { id: customer.linkedVendorId, orgId: ctx.orgId },
      select: vendorSelect,
    })
    if (linked) {
      if (!linked.isActive) {
        throw precondition(
          `${linked.displayName} is the linked supplier but is archived. Restore the vendor before settling against this customer.`,
        )
      }
      return linked
    }
  }

  const existing = await tx.vendor.findFirst({
    where: { orgId: ctx.orgId, displayName: customer.displayName },
    select: vendorSelect,
  })
  if (existing) {
    if (!existing.isActive) {
      throw precondition(
        `${existing.displayName} exists as an archived vendor. Restore the vendor before settling against this customer.`,
      )
    }
    // Remember the match so statements and contact pages stay connected.
    await tx.customer.update({
      where: { id: customerId },
      data: { linkedVendorId: existing.id },
    })
    return existing
  }

  const created = await tx.vendor.create({
    data: {
      orgId: ctx.orgId,
      displayName: customer.displayName,
      companyName: customer.companyName,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      mobile: customer.mobile,
      taxRegistrationNumber: customer.taxRegistrationNumber,
      billingLine1: customer.billingLine1,
      billingLine2: customer.billingLine2,
      billingCity: customer.billingCity,
      billingRegion: customer.billingRegion,
      billingPostalCode: customer.billingPostalCode,
      billingCountry: customer.billingCountry,
      paymentTermId: customer.paymentTermId,
    },
    select: vendorSelect,
  })
  await tx.customer.update({
    where: { id: customerId },
    data: { linkedVendorId: created.id },
  })
  return created
}

/**
 * Posted purchases must name a product or an expense category. A free-typed
 * description and an amount are not an item — accepting them posts
 * Uncategorised Expense for money that was never categorised.
 */
function assertNamedPurchaseLines(isDraft: boolean, lines: PurchaseDocumentInput['lines']) {
  if (isDraft) return
  const unnamed = unnamedPurchaseLineIndexes(lines)
  if (unnamed.length === 0) return
  throw validation(
    'Every posted line must be a product from the item list, or a category with an expense account. Typed text and an amount are not a purchase.',
    {
      lines: unnamed.map((index) => {
        const name = lines[index]?.description?.trim() || `Line ${index + 1}`
        return `${name}: choose a product or an expense category`
      }),
    },
  )
}

/**
 * Resolve each line's cost account.
 *
 * A purchase line is categorised in one of three ways, in order of precedence:
 * what the line says, what the item says, then the vendor's default. If none of
 * them answers, the posting engine falls back to Uncategorised Expense — visible
 * on the profit and loss, which is the point: money that went somewhere unnamed
 * should be conspicuous rather than hidden.
 *
 * A tracked item is different: its cost belongs to the inventory asset, not to an
 * expense account, so its line carries the item's inventory account instead.
 */
async function resolveLines(
  tx: Tx,
  ctx: OrgContext,
  lines: PurchaseDocumentInput['lines'],
  vendorDefaultAccountId: string | null,
): Promise<DraftSalesLine[]> {
  const itemIds = lines.map((line) => line.itemId).filter(Boolean) as string[]

  const items = itemIds.length
    ? await tx.item.findMany({
        where: { id: { in: itemIds }, orgId: ctx.orgId },
        select: {
          id: true, name: true, type: true, isActive: true, purchaseCost: true,
          purchaseDescription: true, description: true, expenseAccountId: true,
          purchaseTaxCodeId: true, inventoryAccountId: true,
        },
      })
    : []

  const byId = new Map(items.map((item) => [item.id, item]))
  const sellsGoods = items.some((item) => item.type === 'NON_INVENTORY')
  const systemCogsAccountId = sellsGoods ? await systemAccountId(tx, ctx.orgId, 'COGS') : null
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
      throw precondition(`"${item.name}" is archived and cannot be bought.`)
    }
    if (item && (item.type === 'GROUP' || item.type === 'DISCOUNT' || item.type === 'SUBTOTAL' || item.type === 'PAYMENT')) {
      throw validation(
        `"${item.name}" is a sales form item and cannot be bought on a bill or expense.`,
        { lines: ['Choose inventory, a service, a non-inventory part, or another charge'] },
      )
    }
    if (line.storeId && !knownStores.has(line.storeId)) throw notFound('Store')

    const stocked = item?.type === 'INVENTORY' || item?.type === 'INVENTORY_ASSEMBLY'

    return {
      itemId: line.itemId ?? null,
      storeId: line.storeId ?? null,
      description:
        line.description ?? item?.purchaseDescription ?? item?.description ?? item?.name ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice !== '' ? line.unitPrice : (item?.purchaseCost?.toString() ?? '0'),
      discountPercent: line.discountPercent ?? null,
      taxCodeId: ctx.features.enableTax
        ? (line.taxCodeId ?? item?.purchaseTaxCodeId ?? null)
        : null,
      // `incomeAccountId` is the pricing engine's neutral name for "where this
      // line posts". On a purchase that is the expense or asset account — and for
      // tracked stock it is handled separately, so it is left unset here.
      incomeAccountId: stocked
        ? null
        : item?.type === 'NON_INVENTORY'
          ? systemCogsAccountId
          : (line.expenseAccountId ?? item?.expenseAccountId ?? vendorDefaultAccountId ?? null),
      isStock: stocked,
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

const RATE_HEADERS = new Set(['rate', 'unit price', 'unit cost', 'price', 'qimaha', 'qiimaha'])

/**
 * Read the Excel sent back for an RFQ and write each quoted rate onto the matching line.
 * Rows match the exported sheet: SKU first, otherwise the item name.
 */
export async function applyRfqQuotedPrices(ctx: OrgContext, id: string, workbook: string) {
  const records = await workbookRecords(workbook)
  const headerIndex = records.findIndex((row) =>
    row.some((cell) => RATE_HEADERS.has(cell.trim().toLowerCase())),
  )
  if (headerIndex < 0) {
    throw validation('The file has no Rate column. Use the Excel downloaded from this RFQ.')
  }
  const header = records[headerIndex]!.map((cell) => cell.trim().toLowerCase())
  const rateAt = header.findIndex((cell) => RATE_HEADERS.has(cell))
  const skuAt = header.findIndex((cell) => cell === 'sku' || cell === 'product sku')
  const itemAt = header.findIndex(
    (cell) => cell === 'item' || cell === 'product' || cell === 'description' || cell === 'name',
  )
  const quotes = records.slice(headerIndex + 1).flatMap((row) => {
    const cleaned = (row[rateAt] ?? '').trim().replace(/,/g, '')
    if (!cleaned) return []
    const amount = Number(cleaned)
    if (!Number.isFinite(amount) || amount < 0) return []
    return [{ sku: skuAt >= 0 ? row[skuAt]?.trim() ?? '' : '', name: itemAt >= 0 ? row[itemAt]?.trim() ?? '' : '', rate: amount }]
  })
  if (quotes.length === 0) throw validation('No prices were filled in the Rate column.')

  return db.$transaction(async (tx) => {
    const document = await tx.purchaseDocument.findFirst({
      where: { id, orgId: ctx.orgId, type: 'RFQ' },
      select: {
        id: true,
        number: true,
        status: true,
        taxTotal: true,
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            id: true,
            description: true,
            quantity: true,
            item: { select: { name: true, sku: true } },
          },
        },
      },
    })
    if (!document) throw notFound('RFQ')
    if (document.status === 'VOID' || document.status === 'CLOSED') {
      throw precondition(`${document.number} is ${document.status.toLowerCase()} and cannot take prices.`)
    }

    const used = new Set<string>()
    let updated = 0
    for (const quote of quotes) {
      const sku = quote.sku.toLowerCase()
      const name = quote.name.toLowerCase()
      const line = document.lines.find((candidate) => {
        if (used.has(candidate.id)) return false
        const lineSku = candidate.item?.sku?.trim().toLowerCase() ?? ''
        const lineName = (candidate.item?.name ?? '').trim().toLowerCase()
        const lineDescription = (candidate.description ?? '').trim().toLowerCase()
        if (sku && lineSku && lineSku === sku) return true
        if (name && (lineName === name || lineDescription === name)) return true
        return false
      })
      if (!line) continue
      used.add(line.id)
      const amount = line.quantity.times(quote.rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      await tx.purchaseDocumentLine.update({
        where: { id: line.id },
        data: { unitPrice: new Decimal(quote.rate), amount },
      })
      updated += 1
    }
    if (updated === 0) {
      throw validation('None of the rows matched this RFQ. Keep the Item and SKU from the file you sent.')
    }

    const lines = await tx.purchaseDocumentLine.findMany({
      where: { documentId: id },
      select: { amount: true },
    })
    const subtotal = lines.reduce((sum, line) => sum.plus(line.amount), ZERO)
    const total = subtotal.plus(document.taxTotal)
    await tx.purchaseDocument.update({
      where: { id },
      data: { subtotal, total },
    })
    return { updated, skipped: quotes.length - updated }
  })
}
