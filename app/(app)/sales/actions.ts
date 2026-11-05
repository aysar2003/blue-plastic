'use server'

import { revalidatePath } from 'next/cache'
import type { SalesDocumentType } from '@prisma/client'
import { z } from 'zod'

import { toFormState, type FormState } from '@/components/forms/action-state'
import { isCalendarDate } from '@/lib/date'
import { cuid, deleteRecordSchema } from '@/lib/validation/common'
import {
  applyCreditSchema,
  batchInvoiceSchema,
  convertEstimateSchema,
  convertSalesDocumentSchema,
  convertSalesOrderSchema,
  invoiceFromSourceSchema,
  paymentSchema,
  paymentUpdateSchema,
  salesDocumentSchema,
} from '@/lib/validation/sales'
import { action } from '@/server/action'
import { db } from '@/server/db'
import { isAppError } from '@/server/errors'
import * as paymentService from '@/server/services/payment.service'
import * as purchaseService from '@/server/services/purchase.service'
import * as salesService from '@/server/services/sales.service'
import { assertDocumentDeleteAllowed } from '@/server/feature-guards'

function revalidateSales() {
  revalidatePath('/sales')
  revalidatePath('/sales/reports')
  revalidatePath('/sales/invoices')
  revalidatePath('/sales/estimates')
  revalidatePath('/sales/quotations')
  revalidatePath('/sales/sales-orders')
  revalidatePath('/sales/sales-receipts')
  revalidatePath('/sales/credit-memos')
  revalidatePath('/payments')
  revalidatePath('/customers')
  revalidatePath('/reports/ar-aging')
  revalidatePath('/reports/trial-balance')
  revalidatePath('/accounts')
}

const documentType = z.enum([
  'INVOICE',
  'ESTIMATE',
  'QUOTATION',
  'SALES_ORDER',
  'SALES_RECEIPT',
  'CREDIT_MEMO',
  'REFUND_RECEIPT',
])

const documentSearch = z.object({
  type: documentType,
  number: z.string().trim().max(40).optional(),
  date: z.string().trim().max(10).optional(),
  amount: z.string().trim().max(24).optional(),
  amountOp: z.enum(['eq', 'gt', 'lt', 'gte', 'lte']).optional(),
})

export const findSalesDocuments = action
  .requires('invoice:read')
  .input(documentSearch)
  .handler((ctx, input) =>
    salesService.findDocuments(ctx, {
      ...input,
      type: input.type as SalesDocumentType,
    }),
  )

/** @deprecated Prefer findSalesDocuments. */
export const findSalesReceipts = action
  .requires('invoice:read')
  .input(documentSearch.omit({ type: true }))
  .handler((ctx, input) => salesService.findReceipts(ctx, input))

export const getConvertibleSource = action
  .requires('invoice:read')
  .input(z.object({ id: cuid }))
  .handler((ctx, input) => salesService.getConvertibleSource(ctx, input.id))

export const createDocument = action
  .requires('invoice:create')
  .input(salesDocumentSchema.safeExtend({ type: documentType }))
  .handler(async (ctx, input) => {
    const { type, ...rest } = input
    const document = await salesService.create(ctx, type as SalesDocumentType, rest)
    revalidateSales()
    return document
  })

/**
 * One invoice per customer, same date and line. A credit-limit refusal on one
 * customer is recorded and the rest still go through.
 */
export const createBatchInvoices = action
  .requires('invoice:create')
  .input(batchInvoiceSchema)
  .handler(async (ctx, input) => {
    const people = await db.customer.findMany({
      where: { orgId: ctx.orgId, id: { in: input.customerIds } },
      select: { id: true, displayName: true },
    })
    const byId = new Map(people.map((person) => [person.id, person.displayName]))
    const rows: {
      customerId: string
      customerName: string
      ok: boolean
      id?: string
      number?: string
      message?: string
    }[] = []

    for (const customerId of input.customerIds) {
      const customerName = byId.get(customerId)
      if (!customerName) {
        rows.push({ customerId, customerName: 'Unknown customer', ok: false, message: 'Customer not found.' })
        continue
      }
      try {
        const document = await salesService.create(ctx, 'INVOICE', {
          number: undefined,
          customerId,
          date: input.date,
          memo: input.description ?? null,
          saveAsDraft: false,
          acknowledgeCreditLimit: false,
          discountKind: 'percent',
          lines: [
            {
              itemId: input.itemId,
              description: input.description ?? null,
              quantity: input.quantity,
              unitPrice: input.unitPrice,
              taxCodeId: input.taxCodeId ?? null,
            },
          ],
        })
        rows.push({
          customerId,
          customerName,
          ok: true,
          id: document.id,
          number: document.number,
        })
      } catch (error) {
        if (!isAppError(error)) throw error
        rows.push({ customerId, customerName, ok: false, message: error.message })
      }
    }

    revalidateSales()
    revalidatePath('/sales/batch')
    return { rows }
  })

export const updateDocument = action
  .requires('invoice:update')
  .input(salesDocumentSchema.safeExtend({ id: cuid }))
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const document = await salesService.update(ctx, id, rest)
    revalidateSales()
    revalidatePath(`/sales/invoices/${id}`)
    return document
  })

/** New payment promise date on an overdue (or open) invoice. */
export const recordPaymentPromise = action
  .requires('invoice:update')
  .input(
    z.object({
      id: cuid,
      promisedDate: z.string().refine(isCalendarDate, 'Choose a valid date'),
      note: z.string().trim().max(500).optional().nullable(),
    }),
  )
  .handler(async (ctx, input) => {
    const document = await salesService.setPaymentPromise(
      ctx,
      input.id,
      input.promisedDate,
      input.note,
    )
    revalidateSales()
    revalidatePath(`/sales/invoices/${input.id}`)
    return document
  })

/** Drop from / restore to the overdue list without changing the books. */
export const setInvoiceUnOverdue = action
  .requires('invoice:update')
  .input(z.object({ id: cuid, exclude: z.boolean() }))
  .handler(async (ctx, input) => {
    const document = await salesService.setExcludeFromOverdue(ctx, input.id, input.exclude)
    revalidateSales()
    revalidatePath(`/sales/invoices/${input.id}`)
    return document
  })

/**
 * Delete a sales document.
 *
 * One action, whatever state the document is in. Nothing is offered instead.
 */
export const deleteDocument = action
  .requires('invoice:void')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    assertDocumentDeleteAllowed(ctx)
    const document = await salesService.remove(ctx, input.id, input.reason)
    revalidateSales()
    revalidatePath('/reports')
    return document
  })

export const convertEstimate = action
  .requires('invoice:create')
  .input(convertEstimateSchema)
  .handler(async (ctx, input) => {
    const invoice = await salesService.convertEstimate(ctx, input.id, input.date)
    revalidateSales()
    return invoice
  })

export const invoiceFromSource = action
  .requires('invoice:create')
  .input(invoiceFromSourceSchema)
  .handler(async (ctx, input) => {
    const invoice = await salesService.invoiceFromSource(ctx, input)
    revalidateSales()
    revalidatePath(`/sales/invoices/${invoice.id}`)
    return invoice
  })

/** Posted bill and expense lines waiting to be recharged to this customer. */
export const listBillableExpenses = action
  .requires('invoice:read')
  .input(z.object({ customerId: cuid }))
  .handler((ctx, input) => purchaseService.listBillableExpenses(ctx, input.customerId))

export const convertSalesDocument = action
  .requires('invoice:create')
  .input(convertSalesDocumentSchema)
  .handler(async (ctx, input) => {
    const document = await salesService.convertSalesDocument(
      ctx,
      input.id,
      input.date,
      input.target,
      input.depositAccountId,
    )
    revalidateSales()
    return document
  })

export const convertSalesOrder = action
  .requires('invoice:create')
  .input(convertSalesOrderSchema)
  .handler(async (ctx, input) => {
    const document = await salesService.convertSalesDocument(
      ctx,
      input.id,
      input.date,
      input.target,
      input.depositAccountId,
    )
    revalidateSales()
    return document
  })

export const createPayment = action
  .requires('payment:create')
  .input(paymentSchema)
  .handler(async (ctx, input) => {
    const payment = await paymentService.create(ctx, input)
    revalidateSales()
    return payment
  })

export const updatePayment = action
  .requires('payment:update')
  .input(paymentUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const payment = await paymentService.update(ctx, id, rest)
    revalidateSales()
    revalidatePath(`/payments/${id}`)
    return payment
  })

export const applyCredit = action
  .requires('payment:create')
  .input(applyCreditSchema)
  .handler(async (ctx, input) => {
    const credit = await paymentService.applyCredit(ctx, input.creditDocumentId, input.applications)
    revalidateSales()
    return credit
  })

export const unapply = action
  .requires('payment:update')
  .input(z.object({ id: cuid }))
  .handler(async (ctx, input) => {
    const result = await paymentService.unapply(ctx, input.id)
    revalidateSales()
    return result
  })

export const deletePayment = action
  .requires('payment:void')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    assertDocumentDeleteAllowed(ctx)
    const payment = await paymentService.remove(ctx, input.id, input.reason)
    revalidateSales()
    revalidatePath('/banking/accounts')
    return payment
  })

/* --- Form adapters -------------------------------------------------------- */

/** Documents carry an array of lines, so the form posts JSON rather than flat fields. */
/**
 * Progress invoice form posts JSON: the line grid is an array, and flattening
 * then re-parsing it would only invent a chance to lose a line.
 */
export async function invoiceFromSourceForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The invoice could not be read. Please try again.' }
  }

  const result = await invoiceFromSource(parsed)
  return toFormState(
    result,
    result.ok && 'number' in result.data
      ? `Invoice ${result.data.number} created. ${
          result.data.sourceStatus === 'CLOSED'
            ? `${result.data.sourceNumber} is now fully invoiced.`
            : `${result.data.sourceNumber} still has lines outstanding.`
        }`
      : 'Invoice created.',
  )
}

export async function saveDocumentForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The document could not be read. Please try again.' }
  }

  const result = parsed.id ? await updateDocument(parsed) : await createDocument(parsed)
  return toFormState(
    result,
    result.ok && 'number' in result.data ? `${result.data.number} saved.` : 'Saved.',
  )
}

export async function savePaymentForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The payment could not be read. Please try again.' }
  }

  const result = parsed.id ? await updatePayment(parsed) : await createPayment(parsed)
  return toFormState(
    result,
    result.ok && 'number' in result.data
      ? `Payment ${result.data.number} ${parsed.id ? 'saved' : 'recorded'}.`
      : parsed.id
        ? 'Saved.'
        : 'Recorded.',
  )
}

/** Open balance + recent rows for the invoice form (QuickBooks-style customer strip). */
export const customerOpenBalancePanel = action
  .requires('invoice:read')
  .input(z.object({ customerId: cuid }))
  .handler(async (ctx, { customerId }) => {
    const [balanceRow, estimatesOpen, documents, payments] = await Promise.all([
      db.$queryRaw<{ balance: string }[]>`
        SELECT COALESCE(SUM(l.debit - l.credit), 0)::text AS balance
          FROM journal_lines l
          JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
          JOIN ledger_accounts a ON a.id = l."accountId"
         WHERE l."orgId" = ${ctx.orgId}
           AND l."customerId" = ${customerId}
           AND a.subtype::text = 'ACCOUNTS_RECEIVABLE'
      `,
      db.salesDocument.count({
        where: {
          orgId: ctx.orgId,
          customerId,
          type: 'ESTIMATE',
          status: { in: ['OPEN', 'ACCEPTED'] },
        },
      }),
      db.salesDocument.findMany({
        where: {
          orgId: ctx.orgId,
          customerId,
          type: { in: ['INVOICE', 'CREDIT_MEMO'] },
          status: { notIn: ['DRAFT', 'VOID', 'DECLINED'] },
        },
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        take: 8,
        select: { id: true, type: true, number: true, date: true, total: true },
      }),
      db.customerPayment.findMany({
        where: { orgId: ctx.orgId, customerId, status: { not: 'VOID' } },
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        take: 8,
        select: { id: true, number: true, date: true, amount: true },
      }),
    ])

    const recent = [
      ...documents.map((row) => ({
        id: row.id,
        kind: row.type as 'INVOICE' | 'CREDIT_MEMO',
        number: row.number,
        date: row.date.toISOString().slice(0, 10),
        amount: row.total.toString(),
        href:
          row.type === 'CREDIT_MEMO' ? `/sales/credit-memos/${row.id}` : `/sales/invoices/${row.id}`,
        sort: row.date.getTime(),
      })),
      ...payments.map((row) => ({
        id: row.id,
        kind: 'PAYMENT' as const,
        number: row.number,
        date: row.date.toISOString().slice(0, 10),
        amount: row.amount.toString(),
        href: `/payments/${row.id}`,
        sort: row.date.getTime(),
      })),
    ]
      .sort((a, b) => b.sort - a.sort)
      .slice(0, 8)
      .map(({ sort: _sort, ...row }) => row)

    const short = (iso: string) => {
      const [y, m, d] = iso.split('-')
      return `${d}-${m}-${y?.slice(2)}`
    }

    return {
      openBalance: balanceRow[0]?.balance ?? '0',
      estimatesOpen,
      recent: recent.map((row) => ({ ...row, date: short(row.date) })),
      statementHref: `/reports/statements/customer?customerId=${customerId}&period=all-dates&view=summary`,
    }
  })
