import 'server-only'
import type { PurchaseDocumentStatus, PurchaseDocumentType } from '@prisma/client'

import {
  EXPENSE_KIND_LABELS,
  signedExpenseAmount,
  type ExpenseKind,
  type ExpenseRegisterRow,
} from '@/lib/expense-kinds'
import { lineLabel } from '@/lib/purchase-board'
import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

const DOCUMENT_KINDS = ['BILL', 'EXPENSE', 'PURCHASE_ORDER', 'VENDOR_CREDIT'] as const

export type ExpenseRegister = {
  rows: ExpenseRegisterRow[]
  totals: { subtotal: string; tax: string; total: string }
}

const SLUG: Record<Exclude<ExpenseKind, 'BILL_PAYMENT'>, string> = {
  BILL: 'bills',
  EXPENSE: 'expenses',
  PURCHASE_ORDER: 'purchase-orders',
  VENDOR_CREDIT: 'vendor-credits',
}

function statusWhere(status: string | undefined): PurchaseDocumentStatus[] | undefined {
  if (status === 'open') return ['OPEN', 'PARTIAL', 'DRAFT']
  if (status === 'paid') return ['PAID', 'CLOSED']
  return undefined
}

/**
 * Bills, expenses, purchase orders, supplier credits, and bill payments on one
 * list. Figures come from the documents. Payments and credits are signed so the
 * total is what those rows do to spending, not a sum of absolute values.
 */
export async function expenseRegister(
  ctx: OrgContext,
  options: {
    kind?: ExpenseKind | ''
    status?: string
    from?: CalendarDate
    to?: CalendarDate
    q?: string
  } = {},
): Promise<ExpenseRegister> {
  const kinds = options.kind ? [options.kind] : [...DOCUMENT_KINDS, 'BILL_PAYMENT' as const]
  const documentTypes = kinds.filter((kind): kind is PurchaseDocumentType => kind !== 'BILL_PAYMENT')
  const wantPayments = kinds.includes('BILL_PAYMENT')
  const statuses = statusWhere(options.status)
  const date =
    options.from || options.to
      ? {
          ...(options.from ? { gte: toDate(options.from) } : {}),
          ...(options.to ? { lte: toDate(options.to) } : {}),
        }
      : undefined
  const q = options.q?.trim()

  const [documents, payments] = await Promise.all([
    documentTypes.length === 0
      ? Promise.resolve([])
      : db.purchaseDocument.findMany({
          where: {
            orgId: ctx.orgId,
            type: { in: documentTypes },
            ...(statuses ? { status: { in: statuses } } : {}),
            ...(date ? { date } : {}),
            ...(q
              ? {
                  OR: [
                    { number: { contains: q, mode: 'insensitive' } },
                    { memo: { contains: q, mode: 'insensitive' } },
                    { reference: { contains: q, mode: 'insensitive' } },
                    { vendor: { displayName: { contains: q, mode: 'insensitive' } } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            type: true,
            number: true,
            date: true,
            status: true,
            subtotal: true,
            taxTotal: true,
            total: true,
            vendor: { select: { id: true, displayName: true } },
            lines: { select: { expenseAccount: { select: { name: true } } } },
          },
          orderBy: [{ date: 'desc' }, { number: 'desc' }],
        }),
    wantPayments
      ? db.billPayment.findMany({
          where: {
            orgId: ctx.orgId,
            ...(statuses ? { status: { in: statuses } } : {}),
            ...(date ? { date } : {}),
            ...(q
              ? {
                  OR: [
                    { number: { contains: q, mode: 'insensitive' } },
                    { memo: { contains: q, mode: 'insensitive' } },
                    { reference: { contains: q, mode: 'insensitive' } },
                    { vendor: { displayName: { contains: q, mode: 'insensitive' } } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            number: true,
            date: true,
            status: true,
            amount: true,
            vendor: { select: { id: true, displayName: true } },
            paymentAccount: { select: { name: true } },
          },
          orderBy: [{ date: 'desc' }, { number: 'desc' }],
        })
      : Promise.resolve([]),
  ])

  const rows: ExpenseRegisterRow[] = [
    ...documents.map((document) => {
      const kind = document.type as ExpenseKind
      const subtotal = signedExpenseAmount(kind, document.subtotal.toString())
      const tax = signedExpenseAmount(kind, document.taxTotal.toString())
      const total = signedExpenseAmount(kind, document.total.toString())
      const slug = SLUG[kind as Exclude<ExpenseKind, 'BILL_PAYMENT'>]
      const open = document.status === 'OPEN' || document.status === 'PARTIAL'
      return {
        id: document.id,
        kind,
        typeLabel: EXPENSE_KIND_LABELS[kind],
        date: toCalendarDate(document.date),
        number: document.number,
        payee: document.vendor.displayName,
        payeeId: document.vendor.id,
        category: lineLabel(document.lines.map((line) => line.expenseAccount?.name)),
        subtotal: toMoneyString(subtotal, 2),
        tax: toMoneyString(tax, 2),
        total: toMoneyString(total, 2),
        status: document.status,
        href: `/purchases/${slug}/${document.id}`,
        editHref: document.status === 'VOID' ? null : `/purchases/${slug}/${document.id}/edit`,
        payHref: kind === 'BILL' && open ? `/bill-payments/new?vendor=${document.vendor.id}` : null,
      }
    }),
    ...payments.map((payment) => {
      const total = signedExpenseAmount('BILL_PAYMENT', payment.amount.toString())
      return {
        id: payment.id,
        kind: 'BILL_PAYMENT' as const,
        typeLabel: EXPENSE_KIND_LABELS.BILL_PAYMENT,
        date: toCalendarDate(payment.date),
        number: payment.number,
        payee: payment.vendor.displayName,
        payeeId: payment.vendor.id,
        category: payment.paymentAccount.name,
        subtotal: toMoneyString(total, 2),
        tax: '0.00',
        total: toMoneyString(total, 2),
        status: payment.status,
        href: `/bill-payments/${payment.id}`,
        editHref: payment.status === 'VOID' ? null : `/bill-payments/${payment.id}/edit`,
        payHref: null,
      }
    }),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))

  const totals = rows.reduce(
    (sum, row) => ({
      subtotal: sum.subtotal.plus(row.subtotal),
      tax: sum.tax.plus(row.tax),
      total: sum.total.plus(row.total),
    }),
    { subtotal: ZERO, tax: ZERO, total: ZERO },
  )

  return {
    rows,
    totals: {
      subtotal: toMoneyString(totals.subtotal, 2),
      tax: toMoneyString(totals.tax, 2),
      total: toMoneyString(totals.total, 2),
    },
  }
}

export function expenseTotal(rows: { total: string }[]): Decimal {
  return rows.reduce((sum, row) => sum.plus(row.total), ZERO)
}
