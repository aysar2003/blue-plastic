import 'server-only'
import type { JournalSourceType } from '@prisma/client'

import { db } from '@/server/db'

/**
 * What produced a journal, said in the terms the business uses.
 *
 * A journal knows its `sourceType` and `sourceId` and nothing else, so the
 * journal list could only ever say "Invoice" — not *which* invoice, and not who
 * it was for. That is the wrong way round: nobody looks up a journal for its own
 * sake. They are looking at a figure on a report, they want to know what caused
 * it, and the two questions they are actually asking are **which document** and
 * **who**.
 *
 * So the numbers and the counterparties are resolved here, in one batch per
 * document family rather than one query per row, and every journal carries a
 * link back to the document that made it.
 */
export type JournalSource = {
  /** The document's own number, e.g. `INV-00042`. */
  number: string | null
  /** Where the document lives. Null for entries with no document. */
  href: string | null
  /** Customer or vendor, where the document has one. */
  partyName: string | null
  partyHref: string | null
}

export type SourceRef = { sourceType: JournalSourceType; sourceId: string | null }

const key = (sourceType: string, sourceId: string) => `${sourceType}:${sourceId}`

const SALES_SLUG: Record<string, string> = {
  INVOICE: 'invoices',
  ESTIMATE: 'estimates',
  SALES_RECEIPT: 'sales-receipts',
  CREDIT_MEMO: 'credit-memos',
  REFUND_RECEIPT: 'refunds',
}

const PURCHASE_SLUG: Record<string, string> = {
  BILL: 'bills',
  EXPENSE: 'expenses',
  VENDOR_CREDIT: 'vendor-credits',
  PURCHASE_ORDER: 'purchase-orders',
}

const SALES_SOURCES: JournalSourceType[] = [
  'INVOICE',
  'SALES_RECEIPT',
  'CREDIT_MEMO',
  'REFUND_RECEIPT',
]
const PURCHASE_SOURCES: JournalSourceType[] = ['BILL', 'EXPENSE', 'VENDOR_CREDIT']

export async function resolveSources(
  orgId: string,
  refs: SourceRef[],
): Promise<Map<string, JournalSource>> {
  const resolved = new Map<string, JournalSource>()

  const idsFor = (types: JournalSourceType[]) => [
    ...new Set(
      refs
        .filter((ref) => ref.sourceId && types.includes(ref.sourceType))
        .map((ref) => ref.sourceId as string),
    ),
  ]

  const salesIds = idsFor(SALES_SOURCES)
  const purchaseIds = idsFor(PURCHASE_SOURCES)
  const customerPaymentIds = idsFor(['CUSTOMER_PAYMENT'])
  const billPaymentIds = idsFor(['BILL_PAYMENT'])
  const transferIds = idsFor(['TRANSFER'])
  const depositIds = idsFor(['DEPOSIT'])
  const adjustmentIds = idsFor(['INVENTORY_ADJUSTMENT'])
  const openingIds = idsFor(['OPENING_BALANCE'])

  const [
    salesDocuments,
    purchaseDocuments,
    customerPayments,
    billPayments,
    transfers,
    deposits,
    adjustments,
    openingAccounts,
    openingItems,
    openingCustomers,
    openingVendors,
  ] = await Promise.all([
    salesIds.length
      ? db.salesDocument.findMany({
          where: { orgId, id: { in: salesIds } },
          select: {
            id: true, type: true, number: true,
            customer: { select: { id: true, displayName: true } },
          },
        })
      : [],
    purchaseIds.length
      ? db.purchaseDocument.findMany({
          where: { orgId, id: { in: purchaseIds } },
          select: {
            id: true, type: true, number: true,
            vendor: { select: { id: true, displayName: true } },
          },
        })
      : [],
    customerPaymentIds.length
      ? db.customerPayment.findMany({
          where: { orgId, id: { in: customerPaymentIds } },
          select: { id: true, number: true, customer: { select: { id: true, displayName: true } } },
        })
      : [],
    billPaymentIds.length
      ? db.billPayment.findMany({
          where: { orgId, id: { in: billPaymentIds } },
          select: { id: true, number: true, vendor: { select: { id: true, displayName: true } } },
        })
      : [],
    transferIds.length
      ? db.bankTransfer.findMany({
          where: { orgId, id: { in: transferIds } },
          select: { id: true, number: true },
        })
      : [],
    depositIds.length
      ? db.deposit.findMany({
          where: { orgId, id: { in: depositIds } },
          select: { id: true, number: true },
        })
      : [],
    adjustmentIds.length
      ? db.inventoryAdjustment.findMany({
          where: { orgId, id: { in: adjustmentIds } },
          select: { id: true, number: true },
        })
      : [],
    // An opening balance points at whatever it opened: an account, or an item's
    // opening stock. Both are worth naming.
    openingIds.length
      ? db.ledgerAccount.findMany({
          where: { orgId, id: { in: openingIds } },
          select: { id: true, code: true, name: true },
        })
      : [],
    openingIds.length
      ? db.item.findMany({
          where: { orgId, id: { in: openingIds } },
          select: { id: true, name: true, sku: true },
        })
      : [],
    openingIds.length
      ? db.customer.findMany({
          where: { orgId, id: { in: openingIds } },
          select: { id: true, displayName: true },
        })
      : [],
    openingIds.length
      ? db.vendor.findMany({
          where: { orgId, id: { in: openingIds } },
          select: { id: true, displayName: true },
        })
      : [],
  ])

  for (const document of salesDocuments) {
    const slug = SALES_SLUG[document.type] ?? 'invoices'
    resolved.set(key(document.type, document.id), {
      number: document.number,
      href: `/sales/${slug}/${document.id}`,
      partyName: document.customer.displayName,
      partyHref: `/customers/${document.customer.id}`,
    })
  }

  for (const document of purchaseDocuments) {
    const slug = PURCHASE_SLUG[document.type] ?? 'bills'
    resolved.set(key(document.type, document.id), {
      number: document.number,
      href: `/purchases/${slug}/${document.id}`,
      partyName: document.vendor.displayName,
      partyHref: `/vendors/${document.vendor.id}`,
    })
  }

  for (const payment of customerPayments) {
    resolved.set(key('CUSTOMER_PAYMENT', payment.id), {
      number: payment.number,
      href: `/payments/${payment.id}`,
      partyName: payment.customer.displayName,
      partyHref: `/customers?id=${payment.customer.id}`,
    })
  }

  for (const payment of billPayments) {
    resolved.set(key('BILL_PAYMENT', payment.id), {
      number: payment.number,
      href: `/bill-payments?q=${encodeURIComponent(payment.number)}`,
      partyName: payment.vendor.displayName,
      partyHref: `/vendors/${payment.vendor.id}`,
    })
  }

  for (const transfer of transfers) {
    resolved.set(key('TRANSFER', transfer.id), {
      number: transfer.number,
      href: '/banking#transfers',
      partyName: null,
      partyHref: null,
    })
  }

  for (const deposit of deposits) {
    resolved.set(key('DEPOSIT', deposit.id), {
      number: deposit.number,
      href: '/banking#transfers',
      partyName: null,
      partyHref: null,
    })
  }

  for (const adjustment of adjustments) {
    resolved.set(key('INVENTORY_ADJUSTMENT', adjustment.id), {
      number: adjustment.number,
      href: '/inventory#adjustments',
      partyName: null,
      partyHref: null,
    })
  }

  for (const customer of openingCustomers) {
    resolved.set(key('OPENING_BALANCE', customer.id), {
      number: null,
      href: `/customers?id=${customer.id}`,
      partyName: customer.displayName,
      partyHref: `/customers?id=${customer.id}`,
    })
  }

  for (const vendor of openingVendors) {
    resolved.set(key('OPENING_BALANCE', vendor.id), {
      number: null,
      href: `/vendors?id=${vendor.id}`,
      partyName: vendor.displayName,
      partyHref: `/vendors?id=${vendor.id}`,
    })
  }

  for (const item of openingItems) {
    const id = key('OPENING_BALANCE', item.id)
    if (resolved.has(id)) continue
    resolved.set(id, {
      number: item.sku,
      href: `/inventory/${item.id}`,
      partyName: item.name,
      partyHref: `/inventory/${item.id}`,
    })
  }

  for (const account of openingAccounts) {
    const id = key('OPENING_BALANCE', account.id)
    if (resolved.has(id)) continue
    resolved.set(id, {
      number: account.code,
      href: `/accounts/${account.id}`,
      partyName: null,
      partyHref: null,
    })
  }

  return resolved
}

/** One journal's source, or an empty one for a manual entry. */
export const sourceFor = (
  resolved: Map<string, JournalSource>,
  ref: SourceRef,
): JournalSource =>
  (ref.sourceId ? resolved.get(key(ref.sourceType, ref.sourceId)) : undefined) ?? {
    number: null,
    href: null,
    partyName: null,
    partyHref: null,
  }
