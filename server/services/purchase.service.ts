import 'server-only'
import type { DocumentType, Prisma, PurchaseDocumentType } from '@prisma/client'

import { lineLabel } from '@/lib/purchase-board'
import { toCalendarDate, toDate, today, type CalendarDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { dueDateFor } from '@/lib/payment-terms'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { PurchaseDocumentInput, ReceiveOrderInput } from '@/lib/validation/purchases'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { softDeleteDocument } from '@/server/accounting/deletion'
import { postJournal, reverseJournal } from '@/server/accounting/posting'
import { priceDocument, type DraftSalesLine } from '@/server/accounting/sales-pricing'
import { recordMovement, reverseMovementsFor } from '@/server/accounting/inventory'
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
import * as storeService from '@/server/services/store.service'
import { loadCodeForCalculation } from '@/server/services/tax.service'

const SEQUENCE_FOR: Record<PurchaseDocumentType, DocumentType> = {
  BILL: 'BILL',
  EXPENSE: 'EXPENSE',
  VENDOR_CREDIT: 'VENDOR_CREDIT',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
}

const DOCUMENT_SELECT = {
  id: true, type: true, number: true, date: true, dueDate: true, expiryDate: true,
  status: true, reference: true, memo: true,
  subtotal: true, taxTotal: true, total: true,
  currencyCode: true, paymentAccountId: true, journalId: true, version: true,
  voidedAt: true, voidReason: true, convertedFromId: true, paymentTermId: true,
  vendor: { select: { id: true, displayName: true, email: true, phone: true } },
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
    sort?: string
    dir?: 'asc' | 'desc'
    from?: CalendarDate
    to?: CalendarDate
  } = {},
) {
  const where: Prisma.PurchaseDocumentWhereInput = {
    orgId: ctx.orgId,
    type,
    ...(options.vendorId ? { vendorId: options.vendorId } : {}),
    ...(options.status === 'open' ? { status: { in: ['OPEN', 'PARTIAL'] } } : {}),
    ...(options.status === 'overdue'
      ? { status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: toDate(today(ctx.organization.timeZone)) } }
      : {}),
    ...(options.status === 'draft' ? { status: 'DRAFT' } : {}),
    ...(options.status === 'paid' ? { status: 'PAID' } : {}),
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
    const vendor = await requireVendor(tx, ctx, input.vendorId)
    const lines = await resolveLines(tx, ctx, input.lines, vendor.defaultExpenseAccountId)
    const taxCodes = await loadTaxCodes(tx, ctx, lines)
    const priced = priceDocument(lines, taxCodes, ctx.organization.baseCurrency)

    if (priced.total.isZero() && type !== 'PURCHASE_ORDER') {
      throw validation('A document with no value has nothing to record.')
    }

    const term = input.paymentTermId
      ? await tx.paymentTerm.findFirst({
          where: { id: input.paymentTermId, orgId: ctx.orgId },
          select: { id: true, type: true, dueDays: true },
        })
      : vendor.paymentTerm

    const isDraft = input.saveAsDraft === true

    // An expense is paid at once, so it has to say from where — checked before
    // anything is written rather than by the journal builder throwing later.
    if (type === 'EXPENSE' && !isDraft) {
      await requirePaymentAccount(tx, ctx, input.paymentAccountId)
    }

    const number = await assignDocumentNumber(tx, ctx.orgId, SEQUENCE_FOR[type], input.number)
    const clash = await tx.purchaseDocument.findFirst({
      where: { orgId: ctx.orgId, type, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    const document = await tx.purchaseDocument.create({
      data: {
        orgId: ctx.orgId,
        type,
        number,
        vendorId: vendor.id,
        date: toDate(input.date),
        dueDate: type === 'BILL' ? toDate(dueDateFor(input.date, term ?? null)) : null,
        expiryDate:
          type === 'PURCHASE_ORDER' && input.expiryDate ? toDate(input.expiryDate) : null,
        paymentTermId: term?.id ?? null,
        status: isDraft ? 'DRAFT' : 'OPEN',
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        subtotal: priced.subtotal.toFixed(4),
        taxTotal: priced.taxTotal.toFixed(4),
        total: priced.total.toFixed(4),
        currencyCode: ctx.organization.baseCurrency,
        paymentAccountId: input.paymentAccountId ?? null,
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

    if (!isDraft && PURCHASE_POSTS_A_JOURNAL[type]) {
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

    if (existing.type === 'EXPENSE' && !input.saveAsDraft) {
      await requirePaymentAccount(tx, ctx, input.paymentAccountId)
    }

    const vendor = await requireVendor(tx, ctx, input.vendorId)
    const lines = await resolveLines(tx, ctx, input.lines, vendor.defaultExpenseAccountId)
    const taxCodes = await loadTaxCodes(tx, ctx, lines)
    const priced = priceDocument(lines, taxCodes, ctx.organization.baseCurrency)

    const term = input.paymentTermId
      ? await tx.paymentTerm.findFirst({
          where: { id: input.paymentTermId, orgId: ctx.orgId },
          select: { id: true, type: true, dueDays: true },
        })
      : vendor.paymentTerm

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

    await tx.purchaseDocument.update({
      where: { id },
      data: {
        number,
        vendorId: vendor.id,
        date: toDate(input.date),
        dueDate: existing.type === 'BILL' ? toDate(dueDateFor(input.date, term ?? null)) : null,
        // A purchase order's expiry survives an edit. It used to be silently
        // dropped, so editing an order threw away the date it was good until.
        expiryDate:
          existing.type === 'PURCHASE_ORDER' && input.expiryDate ? toDate(input.expiryDate) : null,
        paymentTermId: term?.id ?? null,
        reference: input.reference ?? null,
        memo: input.memo ?? null,
        subtotal: priced.subtotal.toFixed(4),
        taxTotal: priced.taxTotal.toFixed(4),
        total: priced.total.toFixed(4),
        paymentAccountId: input.paymentAccountId ?? null,
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
            expenseAccountId: line.incomeAccountId,
          })),
        },
      },
    })

    if (!input.saveAsDraft && PURCHASE_POSTS_A_JOURNAL[existing.type]) {
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
      paymentAccountId: true, journalId: true,
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
  if (!PURCHASE_POSTS_A_JOURNAL[document.type]) return null
  if (document.journalId) throw conflict(`${document.number} is already posted.`)

  const taxCodes = await loadTaxCodes(
    tx,
    ctx,
    document.lines.map((line) => ({ taxCodeId: line.taxCodeId })),
  )

  const priced = priceDocument(
    document.lines.map((line) => ({
      itemId: line.itemId,
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent?.toString() ?? null,
      taxCodeId: line.taxCodeId,
      // Tracked stock is priced but not expensed: its cost is added to the
      // inventory asset below instead.
      incomeAccountId: line.item?.type === 'INVENTORY' ? null : line.expenseAccountId,
      isStock: line.item?.type === 'INVENTORY',
    })),
    taxCodes,
    ctx.organization.baseCurrency,
  )

  const input: PurchaseJournalInput = {
    date: toCalendarDate(document.date),
    number: document.number,
    documentId: document.id,
    vendorId: document.vendorId,
    priced,
    payableAccountId: await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_PAYABLE'),
    paymentAccountId: document.paymentAccountId,
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
      if (line.item?.type !== 'INVENTORY') continue
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
  isTracked: boolean
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
          id: true, lineNumber: true, itemId: true, description: true,
          quantity: true, quantityReceived: true, unitPrice: true,
          item: { select: { name: true, sku: true, type: true } },
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
      isTracked: line.item?.type === 'INVENTORY',
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
        paymentTermId: true,
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
    const receiving = new Map<string, Decimal>()

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

      receiving.set(line.id, quantity)
    }

    if (receiving.size === 0) {
      throw validation('Enter a quantity against at least one line.')
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
        lines: order.lines
          .filter((line) => receiving.has(line.id))
          .map((line) => ({
            itemId: line.itemId,
            storeId: line.storeId,
            expenseAccountId: line.expenseAccountId,
            description: line.description,
            quantity: receiving.get(line.id)!.toString(),
            unitPrice: line.unitPrice.toString(),
            discountPercent: line.discountPercent?.toString() ?? null,
            taxCodeId: line.taxCodeId,
          })),
      } as PurchaseDocumentInput,
      meta,
    )

    await tx.purchaseDocument.update({
      where: { id: bill.id },
      data: { convertedFromId: order.id },
    })

    for (const [lineId, quantity] of receiving) {
      await tx.purchaseDocumentLine.update({
        where: { id: lineId },
        data: { quantityReceived: { increment: quantity.toFixed(4) } },
      })
    }

    // Closed once nothing is outstanding; otherwise it stays open, showing what
    // is still owed rather than disappearing off the list of live orders.
    const outstanding = order.lines.reduce((total, line) => {
      const received = new Decimal(line.quantityReceived.toString()).plus(
        receiving.get(line.id) ?? 0,
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
 * Required, because an expense that does not say where the money came from
 * cannot be posted — and the failure used to surface as a bare `Error` from the
 * journal builder, with no field to point at. Any balance-sheet account is
 * allowed: a business pays for things out of petty cash and director's loans as
 * well as out of the bank. Income and expense accounts are refused, since money
 * cannot leave one.
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
    if (line.storeId && !knownStores.has(line.storeId)) throw notFound('Store')

    return {
      itemId: line.itemId ?? null,
      storeId: line.storeId ?? null,
      description:
        line.description ?? item?.purchaseDescription ?? item?.description ?? item?.name ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice !== '' ? line.unitPrice : (item?.purchaseCost?.toString() ?? '0'),
      discountPercent: line.discountPercent ?? null,
      taxCodeId: line.taxCodeId ?? item?.purchaseTaxCodeId ?? null,
      // `incomeAccountId` is the pricing engine's neutral name for "where this
      // line posts". On a purchase that is the expense or asset account — and for
      // tracked stock it is handled separately, so it is left unset here.
      incomeAccountId:
        item?.type === 'INVENTORY'
          ? null
          : (line.expenseAccountId ?? item?.expenseAccountId ?? vendorDefaultAccountId ?? null),
      isStock: item?.type === 'INVENTORY',
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
