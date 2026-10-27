import 'server-only'

import type { PurchaseDocumentType, SalesDocumentType } from '@prisma/client'

import { addDays, toCalendarDate, toDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { formatQty } from '@/lib/quantity'
import { PAYMENT_METHOD_LABELS, STATUS_LABELS } from '@/lib/sales-types'
import { foldStoreQuantities } from '@/lib/store-stock'
import { db, type Tx } from '@/server/db'
import { valuation } from '@/server/accounting/inventory'
import type { ReportContext, ReportRow, ReportTable, TableReport } from './catalogue'

/**
 * Document lists and operational reports that complete the QBO-style catalogue.
 *
 * The statements and the original table reports stay in `catalogue.ts`. These
 * entries are the same shape, so one page and one CSV route render them. Keep
 * helpers local — a value import from catalogue would cycle at load time.
 */

const money = (value: Decimal.Value) => toMoneyString(value, 2)
const date = (value: Date | null | undefined) => (value ? toCalendarDate(value) : null)
const recorded = (value: Date | null | undefined) => {
  if (!value) return null
  const time = value instanceof Date ? value : new Date(value)
  return Number.isNaN(time.getTime()) ? null : time.toISOString()
}

function books(input: ReportContext): Tx {
  return input.client ?? (db as unknown as Tx)
}

/** Hard cap for line-detail reports so a wide date range cannot pull tens of thousands of rows. */
const DETAIL_ROW_LIMIT = 5_000

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function methodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method.replaceAll('_', ' ').toLowerCase()
}

const SALES_SLUG: Record<string, string> = {
  INVOICE: 'invoices',
  ESTIMATE: 'estimates',
  QUOTATION: 'quotations',
  SALES_ORDER: 'sales-orders',
  SALES_RECEIPT: 'sales-receipts',
  CREDIT_MEMO: 'credit-memos',
  REFUND_RECEIPT: 'refunds',
}

const PURCHASE_SLUG: Record<string, string> = {
  BILL: 'bills',
  EXPENSE: 'expenses',
  VENDOR_CREDIT: 'vendor-credits',
  PURCHASE_ORDER: 'purchase-orders',
  PURCHASE_REQUEST: 'purchase-requests',
  RFQ: 'rfqs',
}

const SALES_TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  ESTIMATE: 'Estimate',
  QUOTATION: 'Quotation',
  SALES_ORDER: 'Sales order',
  SALES_RECEIPT: 'Sales receipt',
  CREDIT_MEMO: 'Credit memo',
  REFUND_RECEIPT: 'Refund',
}

const PURCHASE_TYPE_LABEL: Record<string, string> = {
  BILL: 'Bill',
  EXPENSE: 'Expense',
  VENDOR_CREDIT: 'Vendor credit',
  PURCHASE_ORDER: 'Purchase order',
  PURCHASE_REQUEST: 'Purchase request',
  RFQ: 'RFQ',
}

const POSTED_SALES: SalesDocumentType[] = ['INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT']
const POSTED_PURCHASES: PurchaseDocumentType[] = ['BILL', 'EXPENSE', 'VENDOR_CREDIT']

function salesHref(type: string, id: string): string {
  return `/sales/${SALES_SLUG[type] ?? 'invoices'}/${id}`
}

function purchaseHref(type: string, id: string): string {
  return `/purchases/${PURCHASE_SLUG[type] ?? 'bills'}/${id}`
}

function signedSales(type: string, amount: Decimal.Value): Decimal {
  const value = new Decimal(amount.toString())
  return type === 'CREDIT_MEMO' || type === 'REFUND_RECEIPT' ? value.negated() : value
}

function signedPurchase(type: string, amount: Decimal.Value): Decimal {
  const value = new Decimal(amount.toString())
  return type === 'VENDOR_CREDIT' ? value.negated() : value
}

/** QBD-style subtotal rows when a detail report is ordered by a name column. */
function withGroupTotals(
  rows: ReportRow[],
  groupKey: string,
  amountKey = 'amount',
): ReportRow[] {
  const out: ReportRow[] = []
  let group: string | null = null
  let groupTotal = ZERO

  const flush = () => {
    if (group == null) return
    out.push({
      emphasis: true,
      cells: {
        [groupKey]: `Total — ${group}`,
        [amountKey]: money(groupTotal),
      },
    })
    groupTotal = ZERO
  }

  for (const row of rows) {
    const name = String(row.cells[groupKey] ?? '')
    if (group !== name) {
      flush()
      group = name
    }
    const amount = row.cells[amountKey]
    if (amount != null && amount !== '') groupTotal = groupTotal.plus(String(amount))
    out.push(row)
  }
  flush()
  return out
}

function salesDocumentList(spec: {
  key: string
  title: string
  description: string
  group: string
  type: SalesDocumentType
  empty: string
  remaining?: 'invoice' | 'credit'
  extraDate?: 'due' | 'expiry'
}): TableReport {
  return {
    key: spec.key,
    title: spec.title,
    description: spec.description,
    group: spec.group,
    mode: 'range',
    filterKinds: ['customer'],
    async build(input) {
      const { ctx, range, filters } = input
      const documents = await books(input).salesDocument.findMany({
        where: {
          orgId: ctx.orgId,
          type: spec.type,
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        },
        select: {
          id: true,
          number: true,
          date: true,
          createdAt: true,
          dueDate: true,
          expiryDate: true,
          total: true,
          status: true,
          reference: true,
          customer: { select: { displayName: true } },
          applications: spec.remaining === 'invoice' ? { select: { amount: true } } : false,
          creditsApplied: spec.remaining === 'credit' ? { select: { amount: true } } : false,
        },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
      })

      let open = ZERO
      const rows = documents.map((document) => {
        const applied = (document.applications ?? document.creditsApplied ?? []).reduce(
          (sum, row) => sum.plus(row.amount.toString()),
          ZERO,
        )
        const skipBalance = document.status === 'VOID' || document.status === 'DRAFT'
        const balance = skipBalance
          ? ZERO
          : Decimal.max(new Decimal(document.total.toString()).minus(applied), ZERO)
        if (spec.remaining) open = open.plus(balance)
        const extra =
          spec.extraDate === 'expiry'
            ? date(document.expiryDate)
            : spec.extraDate === 'due'
              ? date(document.dueDate)
              : null
        return {
          href: salesHref(spec.type, document.id),
          cells: {
            date: recorded(document.createdAt),
            number: document.number,
            customer: document.customer.displayName,
            extra,
            reference: document.reference,
            status: statusLabel(document.status),
            total: money(document.total.toString()),
            ...(spec.remaining ? { balance: money(balance) } : {}),
          },
        }
      })

      return {
        columns: [
          { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
          { key: 'number', label: 'No.', width: 'w-32' },
          { key: 'customer', label: 'Customer' },
          ...(spec.extraDate
            ? [
                {
                  key: 'extra',
                  label: spec.extraDate === 'expiry' ? 'Expires' : 'Due',
                  format: 'date' as const,
                  width: 'w-28',
                },
              ]
            : []),
          { key: 'reference', label: 'Reference', width: 'w-32' },
          { key: 'status', label: 'Status', width: 'w-36' },
          { key: 'total', label: 'Amount', format: 'money', width: 'w-32' },
          ...(spec.remaining
            ? [{ key: 'balance', label: spec.remaining === 'credit' ? 'Unapplied' : 'Open balance', format: 'money' as const, width: 'w-36' }]
            : []),
        ],
        rows,
        totals: {
          date: 'Total',
          ...(spec.remaining
            ? { balance: money(open) }
            : {
                total: money(
                  documents.reduce((sum, row) => sum.plus(row.total.toString()), ZERO),
                ),
              }),
        },
        empty: spec.empty,
        note: 'Drafts and voids are listed so a period review can see everything that was entered.',
      }
    },
  }
}

function purchaseDocumentList(spec: {
  key: string
  title: string
  description: string
  group: string
  type: PurchaseDocumentType
  empty: string
  remaining?: 'bill' | 'credit'
}): TableReport {
  return {
    key: spec.key,
    title: spec.title,
    description: spec.description,
    group: spec.group,
    mode: 'range',
    filterKinds: ['vendor'],
    async build(input) {
      const { ctx, range, filters } = input
      const documents = await books(input).purchaseDocument.findMany({
        where: {
          orgId: ctx.orgId,
          type: spec.type,
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
        },
        select: {
          id: true,
          number: true,
          date: true,
          createdAt: true,
          dueDate: true,
          total: true,
          status: true,
          reference: true,
          vendor: { select: { displayName: true } },
          applications: spec.remaining === 'bill' ? { select: { amount: true } } : false,
          creditsApplied: spec.remaining === 'credit' ? { select: { amount: true } } : false,
        },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
      })

      let open = ZERO
      const rows = documents.map((document) => {
        const applied = (document.applications ?? document.creditsApplied ?? []).reduce(
          (sum, row) => sum.plus(row.amount.toString()),
          ZERO,
        )
        const skipBalance = document.status === 'VOID' || document.status === 'DRAFT'
        const balance = skipBalance
          ? ZERO
          : Decimal.max(new Decimal(document.total.toString()).minus(applied), ZERO)
        if (spec.remaining) open = open.plus(balance)
        return {
          href: purchaseHref(spec.type, document.id),
          cells: {
            date: recorded(document.createdAt),
            number: document.number,
            vendor: document.vendor?.displayName ?? '—',
            dueDate: date(document.dueDate),
            reference: document.reference,
            status: statusLabel(document.status),
            total: money(document.total.toString()),
            ...(spec.remaining ? { balance: money(balance) } : {}),
          },
        }
      })

      return {
        columns: [
          { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
          { key: 'number', label: 'No.', width: 'w-32' },
          { key: 'vendor', label: 'Vendor' },
          { key: 'dueDate', label: 'Due', format: 'date', width: 'w-28' },
          { key: 'reference', label: 'Their ref', width: 'w-32' },
          { key: 'status', label: 'Status', width: 'w-36' },
          { key: 'total', label: 'Amount', format: 'money', width: 'w-32' },
          ...(spec.remaining
            ? [{ key: 'balance', label: spec.remaining === 'credit' ? 'Unapplied' : 'Open balance', format: 'money' as const, width: 'w-36' }]
            : []),
        ],
        rows,
        totals: {
          date: 'Total',
          ...(spec.remaining
            ? { balance: money(open) }
            : {
                total: money(
                  documents.reduce((sum, row) => sum.plus(row.total.toString()), ZERO),
                ),
              }),
        },
        empty: spec.empty,
      }
    },
  }
}

const estimateList = salesDocumentList({
  key: 'estimate-list',
  title: 'Estimate List',
  description: 'Every estimate dated in the period.',
  group: 'Sales and customers',
  type: 'ESTIMATE',
  empty: 'No estimates in this period.',
  extraDate: 'expiry',
})

const quotationList = salesDocumentList({
  key: 'quotation-list',
  title: 'Quotation List',
  description: 'Every quotation dated in the period.',
  group: 'Sales and customers',
  type: 'QUOTATION',
  empty: 'No quotations in this period.',
  extraDate: 'expiry',
})

const salesOrderList = salesDocumentList({
  key: 'sales-order-list',
  title: 'Sales Order List',
  description: 'Every sales order dated in the period.',
  group: 'Sales and customers',
  type: 'SALES_ORDER',
  empty: 'No sales orders in this period.',
  extraDate: 'due',
})

const salesReceiptList = salesDocumentList({
  key: 'sales-receipt-list',
  title: 'Sales Receipt List',
  description: 'Cash sales dated in the period — paid as they were raised.',
  group: 'Sales and customers',
  type: 'SALES_RECEIPT',
  empty: 'No sales receipts in this period.',
})

const creditMemoList = salesDocumentList({
  key: 'credit-memo-list',
  title: 'Credit Memo List',
  description: 'Credits issued to customers, and how much is still unapplied.',
  group: 'Who owes you',
  type: 'CREDIT_MEMO',
  empty: 'No credit memos in this period.',
  remaining: 'credit',
})

const refundList = salesDocumentList({
  key: 'refund-list',
  title: 'Refund List',
  description: 'Money returned to customers in the period.',
  group: 'Who owes you',
  type: 'REFUND_RECEIPT',
  empty: 'No refunds in this period.',
})

const expenseList = purchaseDocumentList({
  key: 'expense-list',
  title: 'Expense List',
  description: 'Purchases paid on the spot in the period.',
  group: 'Expenses and vendors',
  type: 'EXPENSE',
  empty: 'No expenses in this period.',
})

const vendorCreditList = purchaseDocumentList({
  key: 'vendor-credit-list',
  title: 'Vendor Credit List',
  description: 'Credits from vendors, and how much is still unapplied.',
  group: 'What you owe',
  type: 'VENDOR_CREDIT',
  empty: 'No vendor credits in this period.',
  remaining: 'credit',
})

const purchaseOrderList = purchaseDocumentList({
  key: 'purchase-order-list',
  title: 'Purchase Order List',
  description: 'Every purchase order dated in the period.',
  group: 'What you owe',
  type: 'PURCHASE_ORDER',
  empty: 'No purchase orders in this period.',
})

const salesByItemDetail: TableReport = {
  key: 'sales-by-item-detail',
  title: 'Sales by Product/Service Detail',
  description: 'Each sold line in the period, net of credits and refunds.',
  group: 'Sales and customers',
  mode: 'range',
  filterKinds: ['customer', 'item', 'store'],
  async build(input) {
    const { ctx, range, filters } = input
    const lines = await books(input).salesDocumentLine.findMany({
      where: {
        document: {
          orgId: ctx.orgId,
          type: { in: POSTED_SALES },
          status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        },
        itemId: filters?.itemId ? filters.itemId : { not: null },
        ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      },
      select: {
        quantity: true,
        amount: true,
        unitPrice: true,
        item: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
        document: {
          select: {
            id: true,
            type: true,
            number: true,
            date: true,
            createdAt: true,
            customer: { select: { displayName: true } },
          },
        },
      },
      orderBy: [{ item: { name: 'asc' } }, { document: { date: 'asc' } }],
      take: DETAIL_ROW_LIMIT,
    })

    let total = ZERO
    const detailRows = lines.flatMap((line) => {
      if (!line.item) return []
      const amount = signedSales(line.document.type, line.amount.toString())
      const quantity = signedSales(line.document.type, line.quantity.toString())
      total = total.plus(amount)
      return [
        {
          href: salesHref(line.document.type, line.document.id),
          cells: {
            item: line.item.name,
            sku: line.item.sku,
            customer: line.document.customer.displayName,
            date: recorded(line.document.createdAt),
            type: SALES_TYPE_LABEL[line.document.type] ?? line.document.type,
            number: line.document.number,
            quantity: formatQty(quantity.toFixed(2), line.item.unitOfMeasure),
            rate: money(line.unitPrice.toString()),
            amount: money(amount),
          },
        },
      ]
    })

    return {
      columns: [
        { key: 'item', label: 'Item' },
        { key: 'sku', label: 'SKU', width: 'w-28' },
        { key: 'customer', label: 'Customer' },
        { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
        { key: 'type', label: 'Type', width: 'w-32' },
        { key: 'number', label: 'No.', width: 'w-28' },
        { key: 'quantity', label: 'Qty', width: 'w-28' },
        { key: 'rate', label: 'Rate', format: 'money', width: 'w-28' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows: withGroupTotals(detailRows, 'item'),
      totals: {
        item: lines.length >= DETAIL_ROW_LIMIT ? `First ${DETAIL_ROW_LIMIT}` : 'Total',
        amount: money(total),
      },
      empty: 'No item sales in this period.',
    }
  },
}

const salesByCustomerItem: TableReport = {
  key: 'sales-by-customer-item',
  title: 'Sales by Customer (Item Detail)',
  description: 'Every item each customer bought in the period — qty, rate, and amount.',
  group: 'Sales and customers',
  mode: 'range',
  filterKinds: ['customer', 'item', 'store'],
  async build(input) {
    const { ctx, range, filters } = input
    const lines = await books(input).salesDocumentLine.findMany({
      where: {
        document: {
          orgId: ctx.orgId,
          type: { in: POSTED_SALES },
          status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        },
        itemId: filters?.itemId ? filters.itemId : { not: null },
        ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      },
      select: {
        quantity: true,
        amount: true,
        unitPrice: true,
        item: { select: { name: true, sku: true, unitOfMeasure: true } },
        document: {
          select: {
            id: true,
            type: true,
            number: true,
            createdAt: true,
            customerId: true,
            customer: { select: { displayName: true } },
          },
        },
      },
      orderBy: [{ document: { date: 'asc' } }, { document: { number: 'asc' } }],
      take: DETAIL_ROW_LIMIT,
    })

    const sorted = [...lines].sort((a, b) => {
      const byCustomer = a.document.customer.displayName.localeCompare(
        b.document.customer.displayName,
      )
      if (byCustomer !== 0) return byCustomer
      const aName = a.item?.name ?? ''
      const bName = b.item?.name ?? ''
      return aName.localeCompare(bName)
    })

    let total = ZERO
    let groupCustomer: string | null = null
    let groupTotal = ZERO
    const rows: ReportRow[] = []

    const flushGroup = () => {
      if (groupCustomer == null) return
      rows.push({
        emphasis: true,
        cells: {
          customer: `Total — ${groupCustomer}`,
          item: null,
          sku: null,
          date: null,
          type: null,
          number: null,
          quantity: null,
          rate: null,
          amount: money(groupTotal),
        },
      })
      groupTotal = ZERO
    }

    for (const line of sorted) {
      if (!line.item) continue
      const customer = line.document.customer.displayName
      if (groupCustomer !== customer) {
        flushGroup()
        groupCustomer = customer
      }
      const amount = signedSales(line.document.type, line.amount.toString())
      const quantity = signedSales(line.document.type, line.quantity.toString())
      total = total.plus(amount)
      groupTotal = groupTotal.plus(amount)
      rows.push({
        href: salesHref(line.document.type, line.document.id),
        cells: {
          customer,
          item: line.item.name,
          sku: line.item.sku,
          date: recorded(line.document.createdAt),
          type: SALES_TYPE_LABEL[line.document.type] ?? line.document.type,
          number: line.document.number,
          quantity: formatQty(quantity.toFixed(2), line.item.unitOfMeasure),
          rate: money(line.unitPrice.toString()),
          amount: money(amount),
        },
      })
    }
    flushGroup()

    return {
      columns: [
        { key: 'customer', label: 'Customer' },
        { key: 'item', label: 'Item' },
        { key: 'sku', label: 'SKU', width: 'w-28' },
        { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
        { key: 'type', label: 'Type', width: 'w-32' },
        { key: 'number', label: 'No.', width: 'w-28' },
        { key: 'quantity', label: 'Qty', width: 'w-28' },
        { key: 'rate', label: 'Rate', format: 'money', width: 'w-28' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows,
      totals: {
        customer: lines.length >= DETAIL_ROW_LIMIT ? `First ${DETAIL_ROW_LIMIT}` : 'Total',
        amount: money(total),
      },
      empty: 'No item sales in this period.',
    }
  },
}

const expensesByVendorDetail: TableReport = {
  key: 'expenses-by-vendor-detail',
  title: 'Expenses by Vendor Detail',
  description: 'Each bill, expense, and vendor credit in the period, net of tax.',
  group: 'Expenses and vendors',
  mode: 'range',
  filterKinds: ['vendor'],
  async build(input) {
    const { ctx, range, filters } = input
    const documents = await books(input).purchaseDocument.findMany({
      where: {
        orgId: ctx.orgId,
        type: { in: POSTED_PURCHASES },
        status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
        deletedAt: null,
        date: { gte: toDate(range.from), lte: toDate(range.to) },
        ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
      },
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        createdAt: true,
        subtotal: true,
        vendor: { select: { displayName: true } },
      },
      orderBy: [{ vendor: { displayName: 'asc' } }, { date: 'asc' }, { number: 'asc' }],
    })

    let total = ZERO
    const detailRows = documents.map((document) => {
      const amount = signedPurchase(document.type, document.subtotal.toString())
      total = total.plus(amount)
      return {
        href: purchaseHref(document.type, document.id),
        cells: {
          vendor: document.vendor?.displayName ?? '—',
          date: recorded(document.createdAt),
          type: PURCHASE_TYPE_LABEL[document.type] ?? document.type,
          number: document.number,
          amount: money(amount),
        },
      }
    })

    return {
      columns: [
        { key: 'vendor', label: 'Vendor' },
        { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
        { key: 'type', label: 'Type', width: 'w-36' },
        { key: 'number', label: 'No.', width: 'w-28' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows: withGroupTotals(detailRows, 'vendor'),
      totals: { vendor: 'Total', amount: money(total) },
      empty: 'Nothing spent with a vendor in this period.',
    }
  },
}

const customerContactList: TableReport = {
  key: 'customer-contact-list',
  title: 'Customer Contact List',
  description: 'Every customer, with how to reach them and the sales person on the card.',
  group: 'Sales and customers',
  mode: 'asOf',
  filterKinds: ['customer'],
  async build(input) {
    const customers = await books(input).customer.findMany({
      where: {
        orgId: input.ctx.orgId,
        ...(input.filters?.customerId ? { id: input.filters.customerId } : {}),
      },
      select: {
        id: true,
        displayName: true,
        companyName: true,
        email: true,
        phone: true,
        mobile: true,
        salesPerson: true,
        isActive: true,
        billingCity: true,
      },
      orderBy: { displayName: 'asc' },
    })

    return {
      columns: [
        { key: 'name', label: 'Customer' },
        { key: 'company', label: 'Company' },
        { key: 'phone', label: 'Phone', width: 'w-36' },
        { key: 'email', label: 'Email' },
        { key: 'city', label: 'City', width: 'w-32' },
        { key: 'salesPerson', label: 'Sales person', width: 'w-36' },
        { key: 'active', label: 'Active', width: 'w-24' },
      ],
      rows: customers.map((customer) => ({
        href: `/customers/${customer.id}`,
        cells: {
          name: customer.displayName,
          company: customer.companyName,
          phone: customer.phone ?? customer.mobile,
          email: customer.email,
          city: customer.billingCity,
          salesPerson: customer.salesPerson,
          active: customer.isActive ? 'Yes' : 'No',
        },
      })),
      empty: 'No customers yet.',
    }
  },
}

const vendorContactList: TableReport = {
  key: 'vendor-contact-list',
  title: 'Vendor Contact List',
  description: 'Every vendor, with how to reach them.',
  group: 'Expenses and vendors',
  mode: 'asOf',
  filterKinds: ['vendor'],
  async build(input) {
    const vendors = await books(input).vendor.findMany({
      where: {
        orgId: input.ctx.orgId,
        ...(input.filters?.vendorId ? { id: input.filters.vendorId } : {}),
      },
      select: {
        id: true,
        displayName: true,
        companyName: true,
        email: true,
        phone: true,
        mobile: true,
        isActive: true,
        billingCity: true,
      },
      orderBy: { displayName: 'asc' },
    })

    return {
      columns: [
        { key: 'name', label: 'Vendor' },
        { key: 'company', label: 'Company' },
        { key: 'phone', label: 'Phone', width: 'w-36' },
        { key: 'email', label: 'Email' },
        { key: 'city', label: 'City', width: 'w-32' },
        { key: 'active', label: 'Active', width: 'w-24' },
      ],
      rows: vendors.map((vendor) => ({
        href: `/vendors/${vendor.id}`,
        cells: {
          name: vendor.displayName,
          company: vendor.companyName,
          phone: vendor.phone ?? vendor.mobile,
          email: vendor.email,
          city: vendor.billingCity,
          active: vendor.isActive ? 'Yes' : 'No',
        },
      })),
      empty: 'No vendors yet.',
    }
  },
}

const transactionListByCustomer: TableReport = {
  key: 'transaction-list-by-customer',
  title: 'Transaction List by Customer',
  description: 'Sales documents and payments received, grouped by customer.',
  group: 'Sales and customers',
  mode: 'range',
  filterKinds: ['customer'],
  async build(input) {
    const { ctx, range, filters } = input
    const client = books(input)
    const [documents, payments] = await Promise.all([
      client.salesDocument.findMany({
        where: {
          orgId: ctx.orgId,
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        },
        select: {
          id: true,
          type: true,
          number: true,
          date: true,
          createdAt: true,
          total: true,
          status: true,
          customer: { select: { displayName: true } },
        },
      }),
      client.customerPayment.findMany({
        where: {
          orgId: ctx.orgId,
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        },
        select: {
          id: true,
          number: true,
          date: true,
          createdAt: true,
          amount: true,
          status: true,
          customer: { select: { displayName: true } },
        },
      }),
    ])

    const rows: ReportRow[] = [
      ...documents.map((document) => ({
        href: salesHref(document.type, document.id),
        cells: {
          customer: document.customer.displayName,
          date: recorded(document.createdAt),
          type: SALES_TYPE_LABEL[document.type] ?? document.type,
          number: document.number,
          status: statusLabel(document.status),
          amount: money(signedSales(document.type, document.total.toString())),
        },
      })),
      ...payments.map((payment) => ({
        href: `/payments/${payment.id}`,
        cells: {
          customer: payment.customer.displayName,
          date: recorded(payment.createdAt),
          type: 'Payment',
          number: payment.number,
          status: statusLabel(payment.status),
          amount: money(payment.amount.toString()),
        },
      })),
    ].sort((a, b) => {
      const customer = (a.cells.customer ?? '').localeCompare(b.cells.customer ?? '')
      if (customer !== 0) return customer
      return (a.cells.date ?? '').localeCompare(b.cells.date ?? '')
    })

    return {
      columns: [
        { key: 'customer', label: 'Customer' },
        { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
        { key: 'type', label: 'Type', width: 'w-36' },
        { key: 'number', label: 'No.', width: 'w-32' },
        { key: 'status', label: 'Status', width: 'w-36' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows,
      empty: 'No customer transactions in this period.',
    }
  },
}

const transactionListByVendor: TableReport = {
  key: 'transaction-list-by-vendor',
  title: 'Transaction List by Vendor',
  description: 'Bills, expenses, credits, orders, and payments made, grouped by vendor.',
  group: 'Expenses and vendors',
  mode: 'range',
  filterKinds: ['vendor'],
  async build(input) {
    const { ctx, range, filters } = input
    const client = books(input)
    const [documents, payments] = await Promise.all([
      client.purchaseDocument.findMany({
        where: {
          orgId: ctx.orgId,
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
        },
        select: {
          id: true,
          type: true,
          number: true,
          date: true,
          createdAt: true,
          total: true,
          status: true,
          vendor: { select: { displayName: true } },
        },
      }),
      client.billPayment.findMany({
        where: {
          orgId: ctx.orgId,
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
        },
        select: {
          id: true,
          number: true,
          date: true,
          createdAt: true,
          amount: true,
          status: true,
          vendor: { select: { displayName: true } },
        },
      }),
    ])

    const rows: ReportRow[] = [
      ...documents.map((document) => ({
        href: purchaseHref(document.type, document.id),
        cells: {
          vendor: document.vendor?.displayName ?? '—',
          date: recorded(document.createdAt),
          type: PURCHASE_TYPE_LABEL[document.type] ?? document.type,
          number: document.number,
          status: statusLabel(document.status),
          amount: money(signedPurchase(document.type, document.total.toString())),
        },
      })),
      ...payments.map((payment) => ({
        href: `/bill-payments?q=${encodeURIComponent(payment.number)}`,
        cells: {
          vendor: payment.vendor.displayName,
          date: recorded(payment.createdAt),
          type: 'Bill payment',
          number: payment.number,
          status: statusLabel(payment.status),
          amount: money(payment.amount.toString()),
        },
      })),
    ].sort((a, b) => {
      const vendor = (a.cells.vendor ?? '').localeCompare(b.cells.vendor ?? '')
      if (vendor !== 0) return vendor
      return (a.cells.date ?? '').localeCompare(b.cells.date ?? '')
    })

    return {
      columns: [
        { key: 'vendor', label: 'Vendor' },
        { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
        { key: 'type', label: 'Type', width: 'w-36' },
        { key: 'number', label: 'No.', width: 'w-32' },
        { key: 'status', label: 'Status', width: 'w-36' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows,
      empty: 'No vendor transactions in this period.',
    }
  },
}

const invoicesAndPayments: TableReport = {
  key: 'invoices-and-payments',
  title: 'Invoices and Applied Payments',
  description: 'Invoices in the period and the payments or credits applied to them.',
  group: 'Who owes you',
  mode: 'range',
  filterKinds: ['customer'],
  async build(input) {
    const { ctx, range, filters } = input
    const invoices = await books(input).salesDocument.findMany({
      where: {
        orgId: ctx.orgId,
        type: 'INVOICE',
        status: { notIn: ['DRAFT', 'VOID'] },
        deletedAt: null,
        date: { gte: toDate(range.from), lte: toDate(range.to) },
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      },
      select: {
        id: true,
        number: true,
        date: true,
        total: true,
        customer: { select: { displayName: true } },
        applications: {
          select: {
            amount: true,
            payment: { select: { number: true } },
            creditDocument: { select: { number: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
    })

    let appliedTotal = ZERO
    const rows = invoices.map((invoice) => {
      const applied = invoice.applications.reduce((sum, row) => sum.plus(row.amount.toString()), ZERO)
      appliedTotal = appliedTotal.plus(applied)
      const sources = invoice.applications
        .map((row) => row.payment?.number ?? row.creditDocument?.number)
        .filter((value): value is string => Boolean(value))
      return {
        href: `/sales/invoices/${invoice.id}`,
        cells: {
          date: date(invoice.date),
          number: invoice.number,
          customer: invoice.customer.displayName,
          total: money(invoice.total.toString()),
          applied: money(applied),
          sources: sources.length ? sources.join(', ') : null,
        },
      }
    })

    return {
      columns: [
        { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
        { key: 'number', label: 'Invoice', width: 'w-28' },
        { key: 'customer', label: 'Customer' },
        { key: 'total', label: 'Invoice total', format: 'money', width: 'w-32' },
        { key: 'applied', label: 'Applied', format: 'money', width: 'w-32' },
        { key: 'sources', label: 'Payment / credit' },
      ],
      rows,
      totals: { date: 'Total', applied: money(appliedTotal) },
      empty: 'No invoices in this period.',
    }
  },
}

async function unappliedRows(
  input: ReportContext,
  side: 'customer' | 'vendor',
): Promise<ReportTable> {
  const { ctx, asOf, filters } = input
  if (side === 'customer') {
    const payments = await books(input).customerPayment.findMany({
      where: {
        orgId: ctx.orgId,
        status: { not: 'VOID' },
        deletedAt: null,
        date: { lte: toDate(asOf) },
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      },
      select: {
        id: true,
        number: true,
        date: true,
        amount: true,
        method: true,
        customer: { select: { displayName: true } },
        applications: { select: { amount: true } },
      },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
    })
    let total = ZERO
    const rows = payments.flatMap((payment) => {
      const applied = payment.applications.reduce((sum, row) => sum.plus(row.amount.toString()), ZERO)
      const leftover = new Decimal(payment.amount.toString()).minus(applied)
      if (!leftover.greaterThan(0)) return []
      total = total.plus(leftover)
      return [
        {
          href: `/payments/${payment.id}`,
          cells: {
            date: date(payment.date),
            number: payment.number,
            name: payment.customer.displayName,
            method: methodLabel(payment.method),
            amount: money(payment.amount.toString()),
            unapplied: money(leftover),
          },
        },
      ]
    })
    return {
      columns: [
        { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
        { key: 'number', label: 'Payment', width: 'w-32' },
        { key: 'name', label: 'Customer' },
        { key: 'method', label: 'Method', width: 'w-32' },
        { key: 'amount', label: 'Received', format: 'money', width: 'w-32' },
        { key: 'unapplied', label: 'Unapplied', format: 'money', width: 'w-32' },
      ],
      rows,
      totals: { date: 'Total', unapplied: money(total) },
      empty: 'No unapplied customer payments at this date.',
    }
  }

  const payments = await books(input).billPayment.findMany({
    where: {
      orgId: ctx.orgId,
      status: { not: 'VOID' },
      deletedAt: null,
      date: { lte: toDate(asOf) },
      ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
    },
    select: {
      id: true,
      number: true,
      date: true,
      amount: true,
      method: true,
      vendor: { select: { displayName: true } },
      applications: { select: { amount: true } },
    },
    orderBy: [{ date: 'asc' }, { number: 'asc' }],
  })
  let total = ZERO
  const rows = payments.flatMap((payment) => {
    const applied = payment.applications.reduce((sum, row) => sum.plus(row.amount.toString()), ZERO)
    const leftover = new Decimal(payment.amount.toString()).minus(applied)
    if (!leftover.greaterThan(0)) return []
    total = total.plus(leftover)
    return [
      {
        href: `/bill-payments?q=${encodeURIComponent(payment.number)}`,
        cells: {
          date: date(payment.date),
          number: payment.number,
          name: payment.vendor.displayName,
          method: methodLabel(payment.method),
          amount: money(payment.amount.toString()),
          unapplied: money(leftover),
        },
      },
    ]
  })
  return {
    columns: [
      { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
      { key: 'number', label: 'Payment', width: 'w-32' },
      { key: 'name', label: 'Vendor' },
      { key: 'method', label: 'Method', width: 'w-32' },
      { key: 'amount', label: 'Paid', format: 'money', width: 'w-32' },
      { key: 'unapplied', label: 'On account', format: 'money', width: 'w-32' },
    ],
    rows,
    totals: { date: 'Total', unapplied: money(total) },
    empty: 'No unapplied bill payments at this date.',
  }
}

const unappliedPayments: TableReport = {
  key: 'unapplied-payments',
  title: 'Unapplied Customer Payments',
  description: 'Money received that has not yet been put against an invoice.',
  group: 'Who owes you',
  mode: 'asOf',
  filterKinds: ['customer'],
  async build(input) {
    return unappliedRows(input, 'customer')
  },
}

const unappliedBillPayments: TableReport = {
  key: 'unapplied-bill-payments',
  title: 'Unapplied Bill Payments',
  description: 'Money paid that has not yet been put against a bill.',
  group: 'What you owe',
  mode: 'asOf',
  filterKinds: ['vendor'],
  async build(input) {
    return unappliedRows(input, 'vendor')
  },
}

const openPurchaseOrders: TableReport = {
  key: 'open-purchase-orders',
  title: 'Open Purchase Orders',
  description: 'Orders still outstanding, with how much is left to receive.',
  group: 'What you owe',
  mode: 'asOf',
  filterKinds: ['vendor'],
  async build(input) {
    const orders = await books(input).purchaseDocument.findMany({
      where: {
        orgId: input.ctx.orgId,
        type: 'PURCHASE_ORDER',
        status: { in: ['OPEN', 'PARTIAL', 'PENDING_APPROVAL'] },
        deletedAt: null,
        date: { lte: toDate(input.asOf) },
        ...(input.filters?.vendorId ? { vendorId: input.filters.vendorId } : {}),
      },
      select: {
        id: true,
        number: true,
        date: true,
        status: true,
        total: true,
        vendor: { select: { displayName: true } },
        lines: { select: { quantity: true, quantityReceived: true, amount: true } },
      },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
    })

    let outstanding = ZERO
    const rows = orders.map((order) => {
      const remainingQty = order.lines.reduce((sum, line) => {
        const left = Decimal.max(
          new Decimal(line.quantity.toString()).minus(line.quantityReceived.toString()),
          ZERO,
        )
        return sum.plus(left)
      }, ZERO)
      outstanding = outstanding.plus(order.total.toString())
      return {
        href: `/purchases/purchase-orders/${order.id}`,
        cells: {
          date: date(order.date),
          number: order.number,
          vendor: order.vendor?.displayName ?? '—',
          status: statusLabel(order.status),
          remaining: remainingQty.toFixed(2),
          total: money(order.total.toString()),
        },
      }
    })

    return {
      columns: [
        { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
        { key: 'number', label: 'PO', width: 'w-32' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'status', label: 'Status', width: 'w-36' },
        { key: 'remaining', label: 'Still to receive', format: 'number', width: 'w-36' },
        { key: 'total', label: 'Order total', format: 'money', width: 'w-32' },
      ],
      rows,
      totals: { date: 'Total', total: money(outstanding) },
      empty: 'No open purchase orders at this date.',
    }
  },
}

function openSalesPipeline(spec: {
  key: string
  title: string
  description: string
  type: 'SALES_ORDER' | 'ESTIMATE' | 'QUOTATION'
  empty: string
  numberLabel: string
}): TableReport {
  return {
    key: spec.key,
    title: spec.title,
    description: spec.description,
    group: 'Sales and customers',
    mode: 'asOf',
    filterKinds: ['customer'],
    async build(input) {
      const documents = await books(input).salesDocument.findMany({
        where: {
          orgId: input.ctx.orgId,
          type: spec.type,
          status: { in: ['OPEN', 'PARTIAL', 'PENDING_APPROVAL', 'ACCEPTED'] },
          deletedAt: null,
          convertedTo: { is: null },
          date: { lte: toDate(input.asOf) },
          ...(input.filters?.customerId ? { customerId: input.filters.customerId } : {}),
        },
        select: {
          id: true,
          number: true,
          date: true,
          status: true,
          total: true,
          expiryDate: true,
          dueDate: true,
          customer: { select: { displayName: true } },
        },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
      })

      let outstanding = ZERO
      const rows = documents.map((document) => {
        outstanding = outstanding.plus(document.total.toString())
        return {
          href: salesHref(spec.type, document.id),
          cells: {
            date: date(document.date),
            number: document.number,
            customer: document.customer.displayName,
            status: statusLabel(document.status),
            expires: date(document.expiryDate ?? document.dueDate),
            total: money(document.total.toString()),
          },
        }
      })

      return {
        columns: [
          { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
          { key: 'number', label: spec.numberLabel, width: 'w-32' },
          { key: 'customer', label: 'Customer' },
          { key: 'status', label: 'Status', width: 'w-36' },
          { key: 'expires', label: 'Due / expires', format: 'date', width: 'w-32' },
          { key: 'total', label: 'Amount', format: 'money', width: 'w-32' },
        ],
        rows,
        totals: { date: 'Total', total: money(outstanding) },
        empty: spec.empty,
      }
    },
  }
}

const openSalesOrders = openSalesPipeline({
  key: 'open-sales-orders',
  title: 'Open Sales Orders by Customer',
  description: 'Sales orders still outstanding — not yet converted to a sale.',
  type: 'SALES_ORDER',
  empty: 'No open sales orders at this date.',
  numberLabel: 'SO',
})

const openEstimates = openSalesPipeline({
  key: 'open-estimates',
  title: 'Open Estimates by Customer',
  description: 'Estimates still open or accepted — not yet converted to a sale.',
  type: 'ESTIMATE',
  empty: 'No open estimates at this date.',
  numberLabel: 'Estimate',
})

const BANK_STATUS: Record<string, string> = {
  POSTED: 'Posted',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Awaiting approval',
  VOID: 'Void',
}

async function bankMoveList(
  input: ReportContext,
  sourceType: 'DEPOSIT' | 'TRANSFER',
): Promise<import('./catalogue').ReportTable> {
  const accountId = input.filters?.accountId
  const journals = await books(input).journal.findMany({
    where: {
      orgId: input.ctx.orgId,
      sourceType,
      status: 'POSTED',
      deletedAt: null,
      date: { gte: toDate(input.range.from), lte: toDate(input.range.to) },
      ...(accountId ? { lines: { some: { accountId } } } : {}),
    },
    select: {
      id: true,
      journalNumber: true,
      date: true,
      memo: true,
      status: true,
      lines: {
        select: {
          debit: true,
          credit: true,
          accountId: true,
          account: { select: { code: true, name: true } },
        },
        orderBy: { lineNumber: 'asc' },
      },
    },
    orderBy: [{ date: 'asc' }, { journalNumber: 'asc' }],
  })

  let total = ZERO
  const rows = journals.map((journal) => {
    const amount = journal.lines.reduce((sum, line) => sum.plus(line.debit.toString()), ZERO)
    total = total.plus(amount)
    const accounts = journal.lines
      .map((line) => `${line.account.code} ${line.account.name}`)
      .join(' → ')
    return {
      href: `/journals/${journal.id}`,
      cells: {
        date: date(journal.date),
        number: journal.journalNumber,
        accounts,
        memo: journal.memo,
        status: BANK_STATUS[journal.status] ?? journal.status,
        amount: money(amount),
      },
    }
  })

  return {
    columns: [
      { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
      { key: 'number', label: 'Journal', width: 'w-32' },
      { key: 'accounts', label: 'Accounts' },
      { key: 'memo', label: 'Memo' },
      { key: 'status', label: 'Status', width: 'w-36' },
      { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
    ],
    rows,
    totals: { date: 'Total', amount: money(total) },
    empty: sourceType === 'DEPOSIT' ? 'No deposits in this period.' : 'No transfers in this period.',
  }
}

const depositDetail: TableReport = {
  key: 'deposit-detail',
  title: 'Deposit Detail',
  description: 'Money put into a bank account in the period.',
  group: 'Banking',
  mode: 'range',
  filterKinds: ['account'],
  async build(input) {
    return bankMoveList(input, 'DEPOSIT')
  },
}

const transferDetail: TableReport = {
  key: 'transfer-detail',
  title: 'Transfer Detail',
  description: 'Money moved between accounts in the period.',
  group: 'Banking',
  mode: 'range',
  filterKinds: ['account'],
  async build(input) {
    return bankMoveList(input, 'TRANSFER')
  },
}

const stockByStore: TableReport = {
  key: 'stock-by-store',
  title: 'Inventory by Store',
  description: 'Quantity on hand in each store, at the average cost on the item.',
  group: 'Inventory',
  mode: 'asOf',
  filterKinds: ['item', 'store'],
  async build(input) {
    const client = books(input)
    const { filters } = input
    const [allStores, items, groups, valued] = await Promise.all([
      client.store.findMany({
        where: { orgId: input.ctx.orgId, isActive: true },
        select: { id: true, name: true, isOffice: true },
        orderBy: [{ isOffice: 'desc' }, { name: 'asc' }],
      }),
      client.item.findMany({
        where: {
          orgId: input.ctx.orgId,
          type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
          deletedAt: null,
          isActive: true,
          ...(filters?.itemId ? { id: filters.itemId } : {}),
        },
        select: { id: true, name: true, sku: true, unitOfMeasure: true },
        orderBy: { name: 'asc' },
      }),
      client.inventoryTransaction.groupBy({
        by: ['itemId', 'storeId'],
        where: {
          orgId: input.ctx.orgId,
          ...(filters?.itemId ? { itemId: filters.itemId } : {}),
        },
        _sum: { quantity: true },
      }),
      valuation(client, input.ctx.orgId),
    ])
    const stores = filters?.storeId
      ? allStores.filter((store) => store.id === filters.storeId)
      : allStores
    const officeId = allStores.find((store) => store.isOffice)?.id ?? allStores[0]?.id ?? ''
    const byItem = foldStoreQuantities(
      groups.map((row) => ({
        itemId: row.itemId,
        storeId: row.storeId,
        quantity: row._sum.quantity?.toString() ?? '0',
      })),
      officeId,
    )
    const average = new Map(valued.items.map((item) => [item.itemId, item.averageCost]))

    const storeTotals = new Map(stores.map((store) => [store.id, ZERO]))
    const rows: ReportRow[] = []
    for (const item of items) {
      const places = byItem[item.id] ?? {}
      const totalQty = stores.reduce((sum, store) => sum.plus(places[store.id] ?? '0'), ZERO)
      if (totalQty.isZero()) continue
      const cells: Record<string, string | null> = {
        name: item.name,
        sku: item.sku,
        total: formatQty(totalQty.toFixed(2), item.unitOfMeasure),
        value: money(totalQty.times(average.get(item.id) ?? ZERO)),
      }
      for (const store of stores) {
        const qty = new Decimal(places[store.id] ?? '0')
        storeTotals.set(store.id, (storeTotals.get(store.id) ?? ZERO).plus(qty))
        cells[store.id] = qty.isZero() ? null : formatQty(qty.toFixed(2), item.unitOfMeasure)
      }
      rows.push({ href: `/items/${item.id}/report`, cells })
    }

    return {
      columns: [
        { key: 'name', label: 'Item' },
        { key: 'sku', label: 'SKU', width: 'w-28' },
        ...stores.map((store) => ({ key: store.id, label: store.name, width: 'w-28' })),
        { key: 'total', label: 'On hand', width: 'w-28' },
        { key: 'value', label: 'Value', format: 'money' as const, width: 'w-32' },
      ],
      rows,
      totals: {
        name: 'Total',
        ...Object.fromEntries(stores.map((store) => [store.id, (storeTotals.get(store.id) ?? ZERO).toFixed(2)])),
        value: money(rows.reduce((sum, row) => sum.plus(row.cells.value ?? '0'), ZERO)),
      },
      empty: 'No inventory on hand in any store.',
      note: 'Value is quantity in the store times the item’s current average cost.',
    }
  },
}

const negativeStock: TableReport = {
  key: 'negative-stock',
  title: 'Negative Stock',
  description: 'Items that have gone below zero in a store.',
  group: 'Inventory',
  mode: 'asOf',
  filterKinds: ['item', 'store'],
  async build(input) {
    const client = books(input)
    const { filters } = input
    const [stores, items, groups] = await Promise.all([
      client.store.findMany({
        where: { orgId: input.ctx.orgId, isActive: true },
        select: { id: true, name: true, isOffice: true },
      }),
      client.item.findMany({
        where: {
          orgId: input.ctx.orgId,
          type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
          deletedAt: null,
          ...(filters?.itemId ? { id: filters.itemId } : {}),
        },
        select: { id: true, name: true, sku: true, unitOfMeasure: true },
      }),
      client.inventoryTransaction.groupBy({
        by: ['itemId', 'storeId'],
        where: {
          orgId: input.ctx.orgId,
          ...(filters?.itemId ? { itemId: filters.itemId } : {}),
        },
        _sum: { quantity: true },
      }),
    ])
    const officeId = stores.find((store) => store.isOffice)?.id ?? stores[0]?.id ?? ''
    const byItem = foldStoreQuantities(
      groups.map((row) => ({
        itemId: row.itemId,
        storeId: row.storeId,
        quantity: row._sum.quantity?.toString() ?? '0',
      })),
      officeId,
    )
    const names = new Map(stores.map((store) => [store.id, store.name]))
    const rows: ReportRow[] = []
    for (const item of items) {
      const places = byItem[item.id] ?? {}
      for (const [storeId, qty] of Object.entries(places)) {
        if (filters?.storeId && storeId !== filters.storeId) continue
        const quantity = new Decimal(qty)
        if (!quantity.lessThan(0)) continue
        rows.push({
          href: `/items/${item.id}/report`,
          cells: {
            name: item.name,
            sku: item.sku,
            store: names.get(storeId) ?? 'Office',
            quantity: formatQty(quantity.toFixed(2), item.unitOfMeasure),
          },
        })
      }
    }
    rows.sort((a, b) => (a.cells.name ?? '').localeCompare(b.cells.name ?? ''))

    return {
      columns: [
        { key: 'name', label: 'Item' },
        { key: 'sku', label: 'SKU', width: 'w-28' },
        { key: 'store', label: 'Store' },
        { key: 'quantity', label: 'On hand', width: 'w-28' },
      ],
      rows,
      empty: 'Nothing is below zero.',
    }
  },
}

const assemblyBuilds: TableReport = {
  key: 'assembly-builds',
  title: 'Assembly Builds',
  description: 'Finished goods built from parts in the period.',
  group: 'Inventory',
  mode: 'range',
  filterKinds: ['item', 'store'],
  async build(input) {
    const { filters } = input
    const builds = await books(input).assemblyBuild.findMany({
      where: {
        orgId: input.ctx.orgId,
        deletedAt: null,
        date: { gte: toDate(input.range.from), lte: toDate(input.range.to) },
        ...(filters?.itemId ? { itemId: filters.itemId } : {}),
        ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      },
      select: {
        id: true,
        number: true,
        date: true,
        quantity: true,
        unitCost: true,
        value: true,
        status: true,
        item: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
        store: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
    })

    return {
      columns: [
        { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
        { key: 'number', label: 'Build', width: 'w-32' },
        { key: 'item', label: 'Finished item' },
        { key: 'store', label: 'Store' },
        { key: 'quantity', label: 'Qty', width: 'w-28' },
        { key: 'status', label: 'Status', width: 'w-36' },
        { key: 'value', label: 'Value', format: 'money', width: 'w-32' },
      ],
      rows: builds.map((build) => ({
        href: '/inventory/builds/new',
        cells: {
          date: date(build.date),
          number: build.number,
          item: build.item.name,
          store: build.store?.name ?? null,
          quantity: formatQty(build.quantity.toString(), build.item.unitOfMeasure),
          status: BANK_STATUS[build.status] ?? build.status,
          value: money(build.value.toString()),
        },
      })),
      totals: {
        date: 'Total',
        value: money(builds.reduce((sum, build) => sum.plus(build.value.toString()), ZERO)),
      },
      empty: 'No assemblies were built in this period.',
    }
  },
}

const storeTransfers: TableReport = {
  key: 'store-transfers',
  title: 'Store Transfers',
  description: 'Stock moved from one store to another in the period.',
  group: 'Inventory',
  mode: 'range',
  filterKinds: ['item', 'store'],
  async build(input) {
    const { filters } = input
    const transfers = await books(input).storeTransfer.findMany({
      where: {
        orgId: input.ctx.orgId,
        date: { gte: toDate(input.range.from), lte: toDate(input.range.to) },
        ...(filters?.itemId ? { itemId: filters.itemId } : {}),
        ...(filters?.storeId
          ? {
              OR: [{ fromStoreId: filters.storeId }, { toStoreId: filters.storeId }],
            }
          : {}),
      },
      select: {
        id: true,
        number: true,
        date: true,
        quantity: true,
        value: true,
        status: true,
        item: { select: { name: true, sku: true, unitOfMeasure: true } },
        fromStore: { select: { name: true } },
        toStore: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
    })

    return {
      columns: [
        { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
        { key: 'number', label: 'Transfer', width: 'w-32' },
        { key: 'item', label: 'Item' },
        { key: 'from', label: 'From' },
        { key: 'to', label: 'To' },
        { key: 'quantity', label: 'Qty', width: 'w-28' },
        { key: 'status', label: 'Status', width: 'w-36' },
        { key: 'value', label: 'Value', format: 'money', width: 'w-32' },
      ],
      rows: transfers.map((transfer) => ({
        href: '/stores/transfer/new',
        cells: {
          date: date(transfer.date),
          number: transfer.number,
          item: transfer.item.name,
          from: transfer.fromStore.name,
          to: transfer.toStore.name,
          quantity: formatQty(transfer.quantity.toString(), transfer.item.unitOfMeasure),
          status: BANK_STATUS[transfer.status] ?? transfer.status,
          value: money(transfer.value.toString()),
        },
      })),
      totals: {
        date: 'Total',
        value: money(transfers.reduce((sum, row) => sum.plus(row.value.toString()), ZERO)),
      },
      empty: 'No store transfers in this period.',
    }
  },
}

const PROJECT_STATUS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

const projectList: TableReport = {
  key: 'project-list',
  title: 'Project List',
  description: 'Every job folder, with the customer and the dates on the card.',
  group: 'Projects',
  mode: 'asOf',
  async build(input) {
    const projects = await books(input).project.findMany({
      where: { orgId: input.ctx.orgId },
      select: {
        id: true,
        number: true,
        name: true,
        status: true,
        siteLocation: true,
        startDate: true,
        endDate: true,
        customer: { select: { displayName: true } },
      },
      orderBy: { number: 'asc' },
    })

    return {
      columns: [
        { key: 'number', label: 'No.', width: 'w-28' },
        { key: 'name', label: 'Project' },
        { key: 'customer', label: 'Customer' },
        { key: 'site', label: 'Site' },
        { key: 'status', label: 'Status', width: 'w-28' },
        { key: 'startDate', label: 'Start', format: 'date', width: 'w-28' },
        { key: 'endDate', label: 'End', format: 'date', width: 'w-28' },
      ],
      rows: projects.map((project) => ({
        href: `/projects/${project.id}`,
        cells: {
          number: project.number,
          name: project.name,
          customer: project.customer.displayName,
          site: project.siteLocation,
          status: PROJECT_STATUS[project.status] ?? project.status,
          startDate: date(project.startDate),
          endDate: date(project.endDate),
        },
      })),
      empty: 'No projects yet.',
    }
  },
}

const projectProfitability: TableReport = {
  key: 'project-profitability',
  title: 'Project Profitability',
  description: 'Income against vendor cost on each job in the period.',
  group: 'Projects',
  mode: 'range',
  async build(input) {
    const { ctx, range } = input
    const client = books(input)
    const [projects, sales, purchases] = await Promise.all([
      client.project.findMany({
        where: { orgId: ctx.orgId },
        select: { id: true, number: true, name: true, customer: { select: { displayName: true } } },
        orderBy: { number: 'asc' },
      }),
      client.salesDocument.findMany({
        where: {
          orgId: ctx.orgId,
          projectId: { not: null },
          type: { in: POSTED_SALES },
          status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
        },
        select: { projectId: true, type: true, subtotal: true },
      }),
      client.purchaseDocument.findMany({
        where: {
          orgId: ctx.orgId,
          projectId: { not: null },
          type: { in: POSTED_PURCHASES },
          status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
        },
        select: { projectId: true, type: true, subtotal: true },
      }),
    ])

    const income = new Map<string, Decimal>()
    const cost = new Map<string, Decimal>()
    for (const document of sales) {
      if (!document.projectId) continue
      income.set(
        document.projectId,
        (income.get(document.projectId) ?? ZERO).plus(signedSales(document.type, document.subtotal.toString())),
      )
    }
    for (const document of purchases) {
      if (!document.projectId) continue
      cost.set(
        document.projectId,
        (cost.get(document.projectId) ?? ZERO).plus(signedPurchase(document.type, document.subtotal.toString())),
      )
    }

    let incomeTotal = ZERO
    let costTotal = ZERO
    const rows = projects.flatMap((project) => {
      const earned = income.get(project.id) ?? ZERO
      const spent = cost.get(project.id) ?? ZERO
      if (earned.isZero() && spent.isZero()) return []
      incomeTotal = incomeTotal.plus(earned)
      costTotal = costTotal.plus(spent)
      return [
        {
          href: `/projects/${project.id}`,
          cells: {
            number: project.number,
            name: project.name,
            customer: project.customer.displayName,
            income: money(earned),
            cost: money(spent),
            profit: money(earned.minus(spent)),
          },
        },
      ]
    })

    return {
      columns: [
        { key: 'number', label: 'No.', width: 'w-28' },
        { key: 'name', label: 'Project' },
        { key: 'customer', label: 'Customer' },
        { key: 'income', label: 'Income', format: 'money', width: 'w-32' },
        { key: 'cost', label: 'Cost', format: 'money', width: 'w-32' },
        { key: 'profit', label: 'Profit', format: 'money', width: 'w-32' },
      ],
      rows,
      totals: {
        number: 'Total',
        income: money(incomeTotal),
        cost: money(costTotal),
        profit: money(incomeTotal.minus(costTotal)),
      },
      empty: 'No project activity in this period.',
      note: 'Income is invoices and receipts net of credits. Cost is bills and expenses net of vendor credits. Both exclude tax.',
    }
  },
}

const posSessionList: TableReport = {
  key: 'pos-session-list',
  title: 'POS Session List',
  description: 'Tills opened in the period, with cash counted at close.',
  group: 'Point of sale',
  mode: 'range',
  async build(input) {
    const sessions = await books(input).posSession.findMany({
      where: {
        orgId: input.ctx.orgId,
        openedAt: { gte: toDate(input.range.from), lt: toDate(addDays(input.range.to, 1)) },
      },
      select: {
        id: true,
        status: true,
        openedAt: true,
        closedAt: true,
        openingCash: true,
        closingCash: true,
        expectedCashAtClose: true,
        cashDifference: true,
        openedByUserId: true,
        closedByUserId: true,
        register: { select: { name: true } },
      },
      orderBy: { openedAt: 'asc' },
    })
    const userIds = [
      ...new Set(
        sessions.flatMap((session) => [session.openedByUserId, session.closedByUserId]).filter((id): id is string => Boolean(id)),
      ),
    ]
    const users = userIds.length
      ? await books(input).user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : []
    const names = new Map(users.map((user) => [user.id, user.name]))

    return {
      columns: [
        { key: 'opened', label: 'Opened', format: 'datetime', width: 'w-44' },
        { key: 'register', label: 'Register' },
        { key: 'cashier', label: 'Opened by' },
        { key: 'status', label: 'Status', width: 'w-28' },
        { key: 'opening', label: 'Opening cash', format: 'money', width: 'w-32' },
        { key: 'expected', label: 'Expected', format: 'money', width: 'w-32' },
        { key: 'counted', label: 'Counted', format: 'money', width: 'w-32' },
        { key: 'difference', label: 'Over / short', format: 'money', width: 'w-32' },
      ],
      rows: sessions.map((session) => ({
        href: '/pos/sessions',
        cells: {
          opened: recorded(session.openedAt),
          register: session.register.name,
          cashier: names.get(session.openedByUserId) ?? null,
          status: session.status === 'OPEN' ? 'Open' : 'Closed',
          opening: money(session.openingCash.toString()),
          expected: session.expectedCashAtClose ? money(session.expectedCashAtClose.toString()) : null,
          counted: session.closingCash ? money(session.closingCash.toString()) : null,
          difference: session.cashDifference ? money(session.cashDifference.toString()) : null,
        },
      })),
      empty: 'No POS sessions in this period.',
    }
  },
}

const posSales: TableReport = {
  key: 'pos-sales',
  title: 'POS Sales',
  description: 'Receipts rung up at the till in the period.',
  group: 'Point of sale',
  mode: 'range',
  async build(input) {
    const orders = await books(input).posOrder.findMany({
      where: {
        orgId: input.ctx.orgId,
        salesDocument: {
          deletedAt: null,
          date: { gte: toDate(input.range.from), lte: toDate(input.range.to) },
        },
      },
      select: {
        id: true,
        changeAmount: true,
        createdAt: true,
        register: { select: { name: true } },
        salesDocument: {
          select: {
            id: true,
            type: true,
            number: true,
            date: true,
            total: true,
            status: true,
            customer: { select: { displayName: true } },
          },
        },
        payments: {
          select: { amount: true, paymentMethod: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    let total = ZERO
    const rows = orders.map((order) => {
      const amount = new Decimal(order.salesDocument.total.toString())
      total = total.plus(amount)
      const tenders = order.payments.map((payment) => payment.paymentMethod.name).join(', ')
      return {
        href: salesHref(order.salesDocument.type, order.salesDocument.id),
        cells: {
          date: recorded(order.createdAt),
          number: order.salesDocument.number,
          register: order.register.name,
          customer: order.salesDocument.customer.displayName,
          tenders: tenders || null,
          change: money(order.changeAmount.toString()),
          status: statusLabel(order.salesDocument.status),
          amount: money(amount),
        },
      }
    })

    return {
      columns: [
        { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
        { key: 'number', label: 'Receipt', width: 'w-32' },
        { key: 'register', label: 'Register' },
        { key: 'customer', label: 'Customer' },
        { key: 'tenders', label: 'Tender' },
        { key: 'change', label: 'Change', format: 'money', width: 'w-28' },
        { key: 'status', label: 'Status', width: 'w-28' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows,
      totals: { date: 'Total', amount: money(total) },
      empty: 'No POS sales in this period.',
    }
  },
}

const RECURRING_TYPE: Record<string, string> = {
  JOURNAL: 'Journal',
  BILL: 'Bill',
  EXPENSE: 'Expense',
}

const RECURRING_FREQ: Record<string, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

const recurringTemplates: TableReport = {
  key: 'recurring-templates',
  title: 'Recurring Transactions',
  description: 'Memorised bills, expenses, and journals, and when they next run.',
  group: 'For my accountant',
  mode: 'asOf',
  async build(input) {
    const templates = await books(input).recurringTemplate.findMany({
      where: { orgId: input.ctx.orgId },
      select: {
        id: true,
        name: true,
        type: true,
        frequency: true,
        interval: true,
        nextRunOn: true,
        endOn: true,
        isActive: true,
        lastRunOn: true,
      },
      orderBy: [{ isActive: 'desc' }, { nextRunOn: 'asc' }],
    })

    return {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type', width: 'w-28' },
        { key: 'frequency', label: 'Frequency', width: 'w-32' },
        { key: 'next', label: 'Next run', format: 'date', width: 'w-28' },
        { key: 'last', label: 'Last run', format: 'date', width: 'w-28' },
        { key: 'end', label: 'Ends', format: 'date', width: 'w-28' },
        { key: 'active', label: 'Active', width: 'w-24' },
      ],
      rows: templates.map((template) => ({
        href: `/banking/recurring/${template.id}`,
        cells: {
          name: template.name,
          type: RECURRING_TYPE[template.type] ?? template.type,
          frequency:
            template.interval === 1
              ? RECURRING_FREQ[template.frequency] ?? template.frequency
              : `Every ${template.interval} ${RECURRING_FREQ[template.frequency]?.toLowerCase() ?? template.frequency}`,
          next: date(template.nextRunOn),
          last: date(template.lastRunOn),
          end: date(template.endOn),
          active: template.isActive ? 'Yes' : 'No',
        },
      })),
      empty: 'No recurring templates.',
    }
  },
}

const APPROVAL_ENTITY: Record<string, string> = {
  SALES_DOCUMENT: 'Sale',
  PURCHASE_DOCUMENT: 'Purchase',
  CUSTOMER_PAYMENT: 'Customer payment',
  BILL_PAYMENT: 'Bill payment',
  JOURNAL: 'Journal',
  INVENTORY_ADJUSTMENT: 'Inventory adjustment',
  BANK_TRANSFER: 'Transfer',
  DEPOSIT: 'Deposit',
  CUSTOMER: 'Customer',
  VENDOR: 'Vendor',
}

const APPROVAL_STATUS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const pendingApprovals: TableReport = {
  key: 'pending-approvals',
  title: 'Pending Approvals',
  description: 'Documents waiting on maker-checker at this date.',
  group: 'For my accountant',
  mode: 'asOf',
  async build(input) {
    const requests = await books(input).approvalRequest.findMany({
      where: {
        orgId: input.ctx.orgId,
        status: 'PENDING',
        submittedAt: { lt: toDate(addDays(input.asOf, 1)) },
      },
      select: {
        id: true,
        title: true,
        href: true,
        entityType: true,
        amount: true,
        submittedAt: true,
        currentLevel: true,
        requiredLevels: true,
        submittedBy: { select: { name: true } },
      },
      orderBy: { submittedAt: 'asc' },
    })

    return {
      columns: [
        { key: 'submitted', label: 'Submitted', format: 'datetime', width: 'w-44' },
        { key: 'title', label: 'Document' },
        { key: 'type', label: 'Type', width: 'w-36' },
        { key: 'submitter', label: 'Created by' },
        { key: 'level', label: 'Level', width: 'w-24' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows: requests.map((request) => ({
        href: request.href,
        cells: {
          submitted: recorded(request.submittedAt),
          title: request.title,
          type: APPROVAL_ENTITY[request.entityType] ?? request.entityType,
          submitter: request.submittedBy.name,
          level: `${request.currentLevel} / ${request.requiredLevels}`,
          amount: request.amount ? money(request.amount.toString()) : null,
        },
      })),
      empty: 'Nothing is waiting for approval.',
    }
  },
}

const approvalHistory: TableReport = {
  key: 'approval-history',
  title: 'Approval History',
  description: 'Documents decided in the period — approved, rejected, or cancelled.',
  group: 'For my accountant',
  mode: 'range',
  async build(input) {
    const requests = await books(input).approvalRequest.findMany({
      where: {
        orgId: input.ctx.orgId,
        status: { not: 'PENDING' },
        decidedAt: { gte: toDate(input.range.from), lt: toDate(addDays(input.range.to, 1)) },
      },
      select: {
        id: true,
        title: true,
        href: true,
        entityType: true,
        status: true,
        amount: true,
        submittedAt: true,
        decidedAt: true,
        submittedBy: { select: { name: true } },
      },
      orderBy: { decidedAt: 'asc' },
    })

    return {
      columns: [
        { key: 'decided', label: 'Decided', format: 'datetime', width: 'w-44' },
        { key: 'title', label: 'Document' },
        { key: 'type', label: 'Type', width: 'w-36' },
        { key: 'submitter', label: 'Created by' },
        { key: 'status', label: 'Status', width: 'w-28' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows: requests.map((request) => ({
        href: request.href,
        cells: {
          decided: recorded(request.decidedAt),
          title: request.title,
          type: APPROVAL_ENTITY[request.entityType] ?? request.entityType,
          submitter: request.submittedBy.name,
          status: APPROVAL_STATUS[request.status] ?? request.status,
          amount: request.amount ? money(request.amount.toString()) : null,
        },
      })),
      empty: 'No approval decisions in this period.',
    }
  },
}

const salesDelivery: TableReport = {
  key: 'sales-delivery',
  title: 'Sales Delivery',
  description: 'Dispatch notes for the period — customer, source document, qty shipped.',
  group: 'Sales and customers',
  mode: 'range',
  async build(input) {
    const client = books(input)
    const notes = await client.deliveryNote.findMany({
      where: {
        orgId: input.ctx.orgId,
        date: { gte: toDate(input.range.from), lte: toDate(input.range.to) },
        status: { not: 'VOID' },
      },
      select: {
        id: true,
        number: true,
        date: true,
        issuedAt: true,
        status: true,
        carrier: true,
        customer: { select: { displayName: true } },
        salesDocument: { select: { id: true, number: true, type: true } },
        store: { select: { name: true } },
        lines: { select: { quantity: true } },
      },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
    })

    let totalQty = ZERO
    const rows: ReportRow[] = notes.map((note) => {
      const qty = note.lines.reduce((sum, line) => sum.plus(line.quantity.toString()), ZERO)
      totalQty = totalQty.plus(qty)
      const slug = SALES_SLUG[note.salesDocument.type] ?? 'invoices'
      return {
        href: `/sales/delivery/${note.id}`,
        cells: {
          number: note.number,
          date: date(note.date),
          issued: recorded(note.issuedAt),
          customer: note.customer.displayName,
          document: note.salesDocument.number,
          store: note.store?.name ?? null,
          carrier: note.carrier,
          status: statusLabel(note.status),
          qty: formatQty(qty.toFixed(2)),
        },
        cellHrefs: {
          document: `/sales/${slug}/${note.salesDocument.id}`,
        },
      }
    })

    return {
      columns: [
        { key: 'number', label: 'Note', width: 'w-32' },
        { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
        { key: 'issued', label: 'Issued', format: 'datetime', width: 'w-44' },
        { key: 'customer', label: 'Customer' },
        { key: 'document', label: 'Invoice / receipt', width: 'w-36' },
        { key: 'store', label: 'Store', width: 'w-36' },
        { key: 'carrier', label: 'Carrier', width: 'w-32' },
        { key: 'status', label: 'Status', width: 'w-28' },
        { key: 'qty', label: 'Qty', format: 'number', width: 'w-24' },
      ],
      rows,
      totals: { number: `${notes.length} notes`, qty: formatQty(totalQty.toFixed(2)) },
      empty: 'No delivery notes in this period.',
    }
  },
}

const bankReconciliationHistory: TableReport = {
  key: 'bank-reconciliation-history',
  title: 'Bank Reconciliation History',
  description: 'Finished and in-progress reconciliations — statement date, balances, cleared lines.',
  group: 'Banking',
  mode: 'range',
  async build(input) {
    const client = books(input)
    const rows = await client.bankReconciliation.findMany({
      where: {
        orgId: input.ctx.orgId,
        statementDate: { gte: toDate(input.range.from), lte: toDate(input.range.to) },
      },
      select: {
        id: true,
        statementDate: true,
        statementEndingBalance: true,
        beginningBalance: true,
        status: true,
        startedAt: true,
        completedAt: true,
        account: { select: { id: true, code: true, name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ statementDate: 'desc' }, { startedAt: 'desc' }],
    })

    return {
      columns: [
        { key: 'account', label: 'Account' },
        { key: 'statementDate', label: 'Statement date', format: 'date', width: 'w-32' },
        { key: 'beginning', label: 'Beginning', format: 'money', width: 'w-32' },
        { key: 'ending', label: 'Statement end', format: 'money', width: 'w-32' },
        { key: 'cleared', label: 'Cleared lines', format: 'number', width: 'w-28' },
        { key: 'status', label: 'Status', width: 'w-32' },
        { key: 'completed', label: 'Completed', format: 'datetime', width: 'w-44' },
      ],
      rows: rows.map((row) => ({
        href: `/banking/reconcile/${row.id}`,
        cells: {
          account: `${row.account.code} ${row.account.name}`,
          statementDate: date(row.statementDate),
          beginning: money(row.beginningBalance.toString()),
          ending: money(row.statementEndingBalance.toString()),
          cleared: String(row._count.entries),
          status: row.status === 'COMPLETED' ? 'Completed' : 'In progress',
          completed: recorded(row.completedAt),
        },
      })),
      empty: 'No reconciliations in this period.',
    }
  },
}

const periodCloseStatus: TableReport = {
  key: 'period-close-status',
  title: 'Period Close Status',
  description: 'Every accounting period — open or closed, and when it was closed.',
  group: 'For my accountant',
  mode: 'asOf',
  async build(input) {
    const client = books(input)
    const periods = await client.accountingPeriod.findMany({
      where: { orgId: input.ctx.orgId },
      select: {
        id: true,
        periodNumber: true,
        startDate: true,
        endDate: true,
        status: true,
        closedAt: true,
        closedById: true,
        fiscalYear: { select: { year: true } },
      },
      orderBy: [{ startDate: 'desc' }],
    })

    const closerIds = [
      ...new Set(periods.map((row) => row.closedById).filter((id): id is string => Boolean(id))),
    ]
    const closers =
      closerIds.length > 0
        ? await client.user.findMany({
            where: { id: { in: closerIds } },
            select: { id: true, name: true },
          })
        : []
    const closerName = new Map(closers.map((user) => [user.id, user.name]))

    const asOfTime = toDate(input.asOf).getTime()
    const visible = periods.filter((period) => period.startDate.getTime() <= asOfTime)

    return {
      columns: [
        { key: 'year', label: 'Fiscal year', width: 'w-36' },
        { key: 'period', label: 'Period', width: 'w-24' },
        { key: 'start', label: 'Start', format: 'date', width: 'w-28' },
        { key: 'end', label: 'End', format: 'date', width: 'w-28' },
        { key: 'status', label: 'Status', width: 'w-28' },
        { key: 'closedAt', label: 'Closed', format: 'datetime', width: 'w-44' },
        { key: 'closedBy', label: 'Closed by' },
      ],
      rows: visible.map((period) => ({
        href: '/periods',
        cells: {
          year: String(period.fiscalYear.year),
          period: String(period.periodNumber),
          start: date(period.startDate),
          end: date(period.endDate),
          status: period.status === 'CLOSED' ? 'Closed' : 'Open',
          closedAt: recorded(period.closedAt),
          closedBy: period.closedById ? (closerName.get(period.closedById) ?? '—') : null,
        },
      })),
      empty: 'No accounting periods set up yet.',
      note: 'Open periods accept postings; closed periods reject them.',
    }
  },
}

const purchasesByItemDetail: TableReport = {
  key: 'purchases-by-item-detail',
  title: 'Purchases by Item Detail',
  description: 'Each purchased line in the period — vendor, qty, rate, and cost.',
  group: 'Expenses and vendors',
  mode: 'range',
  filterKinds: ['vendor', 'item', 'store'],
  async build(input) {
    const { ctx, range, filters } = input
    const lines = await books(input).purchaseDocumentLine.findMany({
      where: {
        document: {
          orgId: ctx.orgId,
          type: { in: POSTED_PURCHASES },
          status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
          deletedAt: null,
          date: { gte: toDate(range.from), lte: toDate(range.to) },
          ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
        },
        itemId: filters?.itemId ? filters.itemId : { not: null },
        ...(filters?.storeId ? { storeId: filters.storeId } : {}),
      },
      select: {
        quantity: true,
        amount: true,
        unitPrice: true,
        item: { select: { name: true, sku: true, unitOfMeasure: true } },
        document: {
          select: {
            id: true,
            type: true,
            number: true,
            createdAt: true,
            vendor: { select: { displayName: true } },
          },
        },
      },
      orderBy: [{ item: { name: 'asc' } }, { document: { date: 'asc' } }],
    })

    let total = ZERO
    const detailRows = lines.flatMap((line) => {
      if (!line.item) return []
      const amount = signedPurchase(line.document.type, line.amount.toString())
      const quantity = signedPurchase(line.document.type, line.quantity.toString())
      total = total.plus(amount)
      return [
        {
          href: purchaseHref(line.document.type, line.document.id),
          cells: {
            item: line.item.name,
            sku: line.item.sku,
            vendor: line.document.vendor?.displayName ?? '—',
            date: recorded(line.document.createdAt),
            type: PURCHASE_TYPE_LABEL[line.document.type] ?? line.document.type,
            number: line.document.number,
            quantity: formatQty(quantity.toFixed(2), line.item.unitOfMeasure),
            rate: money(line.unitPrice.toString()),
            amount: money(amount),
          },
        },
      ]
    })

    return {
      columns: [
        { key: 'item', label: 'Item' },
        { key: 'sku', label: 'SKU', width: 'w-28' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'date', label: 'Date', format: 'datetime', width: 'w-44' },
        { key: 'type', label: 'Type', width: 'w-32' },
        { key: 'number', label: 'No.', width: 'w-28' },
        { key: 'quantity', label: 'Qty', width: 'w-28' },
        { key: 'rate', label: 'Rate', format: 'money', width: 'w-28' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows: withGroupTotals(detailRows, 'item'),
      totals: { item: 'Total', amount: money(total) },
      empty: 'No item purchases in this period.',
    }
  },
}

const salesBySalesPerson: TableReport = {
  key: 'sales-by-sales-person',
  title: 'Sales by Sales Person',
  description: 'Posted sales in the period, grouped by the sales person on the customer.',
  group: 'Sales and customers',
  mode: 'range',
  async build(input) {
    const { ctx, range } = input
    const documents = await books(input).salesDocument.findMany({
      where: {
        orgId: ctx.orgId,
        type: { in: POSTED_SALES },
        status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
        deletedAt: null,
        date: { gte: toDate(range.from), lte: toDate(range.to) },
      },
      select: {
        id: true,
        type: true,
        number: true,
        createdAt: true,
        subtotal: true,
        customer: { select: { displayName: true, salesPerson: true } },
      },
      orderBy: [{ customer: { salesPerson: 'asc' } }, { date: 'asc' }],
    })

    const buckets = new Map<string, { count: number; amount: Decimal }>()
    for (const document of documents) {
      const person = document.customer.salesPerson?.trim() || 'Unassigned'
      const amount = signedSales(document.type, document.subtotal.toString())
      const current = buckets.get(person) ?? { count: 0, amount: ZERO }
      buckets.set(person, { count: current.count + 1, amount: current.amount.plus(amount) })
    }

    let total = ZERO
    const rows = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([person, row]) => {
        total = total.plus(row.amount)
        return {
          cells: {
            person,
            count: String(row.count),
            amount: money(row.amount),
          },
        }
      })

    return {
      columns: [
        { key: 'person', label: 'Sales person' },
        { key: 'count', label: 'Documents', format: 'number', width: 'w-28' },
        { key: 'amount', label: 'Sales', format: 'money', width: 'w-36' },
      ],
      rows,
      totals: { person: 'Total', amount: money(total) },
      empty: 'No sales in this period.',
      note: 'Sales person comes from the customer record.',
    }
  },
}

const inventoryStockStatus: TableReport = {
  key: 'inventory-stock-status',
  title: 'Inventory Stock Status by Item',
  description: 'On hand, reorder point, average cost, and whether stock is low.',
  group: 'Inventory',
  mode: 'asOf',
  filterKinds: ['item'],
  async build(input) {
    const stock = await valuation(books(input), input.ctx.orgId)
    const items = input.filters?.itemId
      ? stock.items.filter((item) => item.itemId === input.filters!.itemId)
      : stock.items

    return {
      columns: [
        { key: 'name', label: 'Item' },
        { key: 'sku', label: 'SKU', width: 'w-32' },
        { key: 'quantity', label: 'On hand', format: 'number', width: 'w-28' },
        { key: 'reorder', label: 'Reorder point', format: 'number', width: 'w-32' },
        { key: 'cost', label: 'Average cost', format: 'money', width: 'w-32' },
        { key: 'value', label: 'Value', format: 'money', width: 'w-32' },
        { key: 'status', label: 'Status', width: 'w-28' },
      ],
      rows: items.map((item) => ({
        href: `/inventory/${item.itemId}`,
        cells: {
          name: item.name,
          sku: item.sku,
          quantity: formatQty(item.quantity.toFixed(2), item.unitOfMeasure),
          reorder: item.reorderPoint
            ? formatQty(item.reorderPoint.toFixed(2), item.unitOfMeasure)
            : null,
          cost: money(item.averageCost),
          value: money(item.value),
          status: item.belowReorder ? 'Reorder' : 'OK',
        },
      })),
      totals: {
        name: 'Total',
        value: money(items.reduce((sum, item) => sum.plus(item.value), ZERO)),
      },
      empty: 'No tracked products yet.',
    }
  },
}

const inventoryValuationDetail: TableReport = {
  key: 'inventory-valuation-detail',
  title: 'Inventory Valuation Detail',
  description: 'Quantity on hand times average cost for each inventory item.',
  group: 'Inventory',
  mode: 'asOf',
  filterKinds: ['item'],
  async build(input) {
    const stock = await valuation(books(input), input.ctx.orgId)
    const items = input.filters?.itemId
      ? stock.items.filter((item) => item.itemId === input.filters!.itemId)
      : stock.items

    return {
      columns: [
        { key: 'name', label: 'Item' },
        { key: 'sku', label: 'SKU', width: 'w-32' },
        { key: 'quantity', label: 'Qty', format: 'number', width: 'w-28' },
        { key: 'cost', label: 'Avg cost', format: 'money', width: 'w-32' },
        { key: 'value', label: 'Asset value', format: 'money', width: 'w-32' },
        { key: 'price', label: 'Sales price', format: 'money', width: 'w-32' },
      ],
      rows: items.map((item) => ({
        href: `/inventory/${item.itemId}`,
        cells: {
          name: item.name,
          sku: item.sku,
          quantity: formatQty(item.quantity.toFixed(2), item.unitOfMeasure),
          cost: money(item.averageCost),
          value: money(item.value),
          price: item.salesPrice ? money(item.salesPrice) : null,
        },
      })),
      totals: {
        name: 'Total',
        value: money(items.reduce((sum, item) => sum.plus(item.value), ZERO)),
      },
      empty: 'No tracked products yet.',
    }
  },
}

const inventoryDaysOnHand: TableReport = {
  key: 'inventory-days-on-hand',
  title: 'Average Days on Hand / Turnover',
  description: 'Days of stock at the recent sales pace, and how many times stock turned in the period.',
  group: 'Inventory',
  mode: 'range',
  filterKinds: ['item'],
  async build(input) {
    const { ctx, range, filters } = input
    const client = books(input)
    const [stock, sold] = await Promise.all([
      valuation(client, ctx.orgId),
      client.salesDocumentLine.findMany({
        where: {
          document: {
            orgId: ctx.orgId,
            type: { in: ['INVOICE', 'SALES_RECEIPT'] },
            status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
            deletedAt: null,
            date: { gte: toDate(range.from), lte: toDate(range.to) },
          },
          itemId: filters?.itemId ? filters.itemId : { not: null },
        },
        select: {
          itemId: true,
          quantity: true,
        },
      }),
    ])

    const days =
      Math.max(
        1,
        Math.round(
          (toDate(range.to).getTime() - toDate(range.from).getTime()) / (24 * 60 * 60 * 1000),
        ) + 1,
      )

    const soldByItem = new Map<string, Decimal>()
    for (const line of sold) {
      if (!line.itemId) continue
      soldByItem.set(
        line.itemId,
        (soldByItem.get(line.itemId) ?? ZERO).plus(line.quantity.toString()),
      )
    }

    const items = filters?.itemId
      ? stock.items.filter((item) => item.itemId === filters.itemId)
      : stock.items

    return {
      columns: [
        { key: 'name', label: 'Item' },
        { key: 'sku', label: 'SKU', width: 'w-32' },
        { key: 'onHand', label: 'On hand', format: 'number', width: 'w-28' },
        { key: 'sold', label: 'Sold in period', format: 'number', width: 'w-32' },
        { key: 'daily', label: 'Avg / day', format: 'number', width: 'w-28' },
        { key: 'days', label: 'Days on hand', format: 'number', width: 'w-32' },
        { key: 'turnover', label: 'Turnover', format: 'number', width: 'w-28' },
      ],
      rows: items.map((item) => {
        const soldQty = soldByItem.get(item.itemId) ?? ZERO
        const daily = soldQty.dividedBy(days)
        const daysOnHand = daily.isZero()
          ? null
          : item.quantity.dividedBy(daily).toDecimalPlaces(1).toString()
        // Qty sold ÷ on-hand approximates turns in the period (QBD-style).
        const turnover = item.quantity.isZero()
          ? null
          : soldQty.dividedBy(item.quantity).toDecimalPlaces(2).toString()
        return {
          href: `/inventory/${item.itemId}`,
          cells: {
            name: item.name,
            sku: item.sku,
            onHand: formatQty(item.quantity.toFixed(2), item.unitOfMeasure),
            sold: formatQty(soldQty.toFixed(2), item.unitOfMeasure),
            daily: daily.isZero() ? null : formatQty(daily.toFixed(2), item.unitOfMeasure),
            days: daysOnHand,
            turnover,
          },
        }
      }),
      empty: 'No tracked products yet.',
      note: `Sales pace uses ${days} days in the selected period. Turnover is quantity sold ÷ on hand.`,
    }
  },
}

const unclearedBankLines: TableReport = {
  key: 'uncleared-bank-lines',
  title: 'Uncleared Bank Transactions',
  description: 'Posted bank and card lines not yet cleared by a completed reconciliation.',
  group: 'Banking',
  mode: 'range',
  filterKinds: ['account'],
  async build(input) {
    const { ctx, range, filters } = input
    const lines = await books(input).journalLine.findMany({
      where: {
        orgId: ctx.orgId,
        journal: {
          status: 'POSTED',
          date: { gte: toDate(range.from), lte: toDate(range.to) },
        },
        account: {
          subtype: { in: ['BANK', 'CREDIT_CARD'] },
          ...(filters?.accountId ? { id: filters.accountId } : {}),
        },
        reconciliation: { is: null },
      },
      select: {
        id: true,
        debit: true,
        credit: true,
        description: true,
        account: { select: { id: true, code: true, name: true } },
        journal: {
          select: {
            id: true,
            journalNumber: true,
            date: true,
            memo: true,
            sourceType: true,
          },
        },
      },
      orderBy: [{ journal: { date: 'asc' } }, { account: { code: 'asc' } }],
      take: 5000,
    })

    let totalDebit = ZERO
    let totalCredit = ZERO
    const rows = lines.map((line) => {
      const debit = new Decimal(line.debit.toString())
      const credit = new Decimal(line.credit.toString())
      totalDebit = totalDebit.plus(debit)
      totalCredit = totalCredit.plus(credit)
      return {
        href: `/journals/${line.journal.id}`,
        cells: {
          date: date(line.journal.date),
          account: `${line.account.code} ${line.account.name}`,
          number: line.journal.journalNumber,
          memo: line.description ?? line.journal.memo,
          debit: debit.isZero() ? null : money(debit),
          credit: credit.isZero() ? null : money(credit),
        },
      }
    })

    return {
      columns: [
        { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
        { key: 'account', label: 'Account' },
        { key: 'number', label: 'Journal', width: 'w-32' },
        { key: 'memo', label: 'Memo' },
        { key: 'debit', label: 'Debit', format: 'money', width: 'w-32' },
        { key: 'credit', label: 'Credit', format: 'money', width: 'w-32' },
      ],
      rows,
      totals: {
        account: `${rows.length} lines`,
        debit: money(totalDebit),
        credit: money(totalCredit),
      },
      empty: 'Every bank line in this period is cleared, or there are none.',
    }
  },
}

const voidedTransactions: TableReport = {
  key: 'voided-transactions',
  title: 'Voided Transactions',
  description: 'Sales and purchase documents voided in the period.',
  group: 'For my accountant',
  mode: 'range',
  async build(input) {
    const { ctx, range } = input
    const client = books(input)
    const [sales, purchases] = await Promise.all([
      client.salesDocument.findMany({
        where: {
          orgId: ctx.orgId,
          status: 'VOID',
          date: { gte: toDate(range.from), lte: toDate(range.to) },
        },
        select: {
          id: true,
          type: true,
          number: true,
          date: true,
          total: true,
          voidedAt: true,
          customer: { select: { displayName: true } },
        },
        orderBy: { date: 'asc' },
      }),
      client.purchaseDocument.findMany({
        where: {
          orgId: ctx.orgId,
          status: 'VOID',
          date: { gte: toDate(range.from), lte: toDate(range.to) },
        },
        select: {
          id: true,
          type: true,
          number: true,
          date: true,
          total: true,
          voidedAt: true,
          vendor: { select: { displayName: true } },
        },
        orderBy: { date: 'asc' },
      }),
    ])

    const rows: ReportRow[] = [
      ...sales.map((document) => ({
        href: salesHref(document.type, document.id),
        cells: {
          date: date(document.date),
          voided: recorded(document.voidedAt),
          side: 'Sales',
          type: SALES_TYPE_LABEL[document.type] ?? document.type,
          number: document.number,
          name: document.customer.displayName,
          amount: money(document.total.toString()),
        },
      })),
      ...purchases.map((document) => ({
        href: purchaseHref(document.type, document.id),
        cells: {
          date: date(document.date),
          voided: recorded(document.voidedAt),
          side: 'Purchases',
          type: PURCHASE_TYPE_LABEL[document.type] ?? document.type,
          number: document.number,
          name: document.vendor?.displayName ?? '—',
          amount: money(document.total.toString()),
        },
      })),
    ].sort((a, b) => String(a.cells.date).localeCompare(String(b.cells.date)))

    return {
      columns: [
        { key: 'date', label: 'Doc date', format: 'date', width: 'w-28' },
        { key: 'voided', label: 'Voided', format: 'datetime', width: 'w-44' },
        { key: 'side', label: 'Area', width: 'w-28' },
        { key: 'type', label: 'Type', width: 'w-36' },
        { key: 'number', label: 'No.', width: 'w-32' },
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount', format: 'money', width: 'w-32' },
      ],
      rows,
      empty: 'No voided documents in this period.',
    }
  },
}

const budgetVsActual: TableReport = {
  key: 'budget-vs-actual',
  title: 'Budget vs Actual',
  description: 'Income and expense accounts — budgeted amount against ledger actuals.',
  group: 'Budgets',
  mode: 'range',
  async build(input) {
    const { ctx, range } = input
    const client = books(input)
    const budgets = await client.budgetLine.findMany({
      where: {
        budget: {
          orgId: ctx.orgId,
          startDate: { lte: toDate(range.to) },
          endDate: { gte: toDate(range.from) },
        },
      },
      select: {
        amount: true,
        account: { select: { id: true, code: true, name: true, type: true } },
        budget: { select: { name: true } },
      },
    })

    if (budgets.length === 0) {
      return {
        columns: [
          { key: 'account', label: 'Account' },
          { key: 'budget', label: 'Budget', format: 'money', width: 'w-32' },
          { key: 'actual', label: 'Actual', format: 'money', width: 'w-32' },
          { key: 'variance', label: 'Variance', format: 'money', width: 'w-32' },
        ],
        rows: [],
        empty: 'No budgets cover this period. Add one under Accounting → Budgets.',
      }
    }

    const accountIds = [...new Set(budgets.map((row) => row.account.id))]
    const actuals = await client.journalLine.groupBy({
      by: ['accountId'],
      where: {
        orgId: ctx.orgId,
        accountId: { in: accountIds },
        journal: {
          status: 'POSTED',
          date: { gte: toDate(range.from), lte: toDate(range.to) },
        },
      },
      _sum: { debit: true, credit: true },
    })
    const actualByAccount = new Map(
      actuals.map((row) => {
        const debit = new Decimal(row._sum.debit?.toString() ?? '0')
        const credit = new Decimal(row._sum.credit?.toString() ?? '0')
        return [row.accountId, { debit, credit }]
      }),
    )

    const rolled = new Map<
      string,
      { code: string; name: string; type: string; budget: Decimal; actual: Decimal }
    >()
    for (const line of budgets) {
      const key = line.account.id
      const current = rolled.get(key) ?? {
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        budget: ZERO,
        actual: ZERO,
      }
      current.budget = current.budget.plus(line.amount.toString())
      const act = actualByAccount.get(key)
      if (act && current.actual.isZero()) {
        // Revenue/equity/liability: credit-natural. Expense/COGS/assets: debit-natural.
        const creditNatural = ['REVENUE', 'EQUITY', 'LIABILITY'].includes(line.account.type)
        current.actual = creditNatural ? act.credit.minus(act.debit) : act.debit.minus(act.credit)
      }
      rolled.set(key, current)
    }

    let budgetTotal = ZERO
    let actualTotal = ZERO
    const rows = [...rolled.entries()]
      .sort(([, a], [, b]) => a.code.localeCompare(b.code))
      .map(([accountId, row]) => {
        budgetTotal = budgetTotal.plus(row.budget)
        actualTotal = actualTotal.plus(row.actual)
        return {
          href: `/reports/transaction-detail?account=${accountId}`,
          cells: {
            account: `${row.code} ${row.name}`,
            budget: money(row.budget),
            actual: money(row.actual),
            variance: money(row.actual.minus(row.budget)),
          },
        }
      })

    return {
      columns: [
        { key: 'account', label: 'Account' },
        { key: 'budget', label: 'Budget', format: 'money', width: 'w-32' },
        { key: 'actual', label: 'Actual', format: 'money', width: 'w-32' },
        { key: 'variance', label: 'Variance', format: 'money', width: 'w-32' },
      ],
      rows,
      totals: {
        account: 'Total',
        budget: money(budgetTotal),
        actual: money(actualTotal),
        variance: money(actualTotal.minus(budgetTotal)),
      },
      empty: 'No budget lines for this period.',
      note: 'Variance is actual minus budget.',
    }
  },
}

export const MODULE_LIST_REPORTS: TableReport[] = [
  estimateList,
  quotationList,
  salesOrderList,
  openSalesOrders,
  openEstimates,
  salesReceiptList,
  creditMemoList,
  refundList,
  salesByItemDetail,
  salesByCustomerItem,
  salesBySalesPerson,
  customerContactList,
  transactionListByCustomer,
  invoicesAndPayments,
  unappliedPayments,
  salesDelivery,
  expenseList,
  vendorCreditList,
  purchaseOrderList,
  openPurchaseOrders,
  expensesByVendorDetail,
  purchasesByItemDetail,
  vendorContactList,
  transactionListByVendor,
  unappliedBillPayments,
  depositDetail,
  transferDetail,
  bankReconciliationHistory,
  unclearedBankLines,
  stockByStore,
  negativeStock,
  inventoryStockStatus,
  inventoryValuationDetail,
  inventoryDaysOnHand,
  assemblyBuilds,
  storeTransfers,
  projectList,
  projectProfitability,
  posSessionList,
  posSales,
  recurringTemplates,
  pendingApprovals,
  approvalHistory,
  voidedTransactions,
  periodCloseStatus,
  budgetVsActual,
]
