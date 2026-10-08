'use server'

import { revalidatePath } from 'next/cache'
import type { SalesDocumentType } from '@prisma/client'
import { z } from 'zod'

import { toFormState, type FormState } from '@/components/forms/action-state'
import { cuid, deleteRecordSchema } from '@/lib/validation/common'
import {
  applyCreditSchema,
  convertEstimateSchema,
  paymentSchema,
  paymentUpdateSchema,
  salesDocumentSchema,
} from '@/lib/validation/sales'
import { action } from '@/server/action'
import * as paymentService from '@/server/services/payment.service'
import * as salesService from '@/server/services/sales.service'
import { assertDocumentDeleteAllowed } from '@/server/feature-guards'

function revalidateSales() {
  revalidatePath('/sales')
  revalidatePath('/sales/reports')
  revalidatePath('/sales/invoices')
  revalidatePath('/sales/estimates')
  revalidatePath('/sales/sales-receipts')
  revalidatePath('/sales/credit-memos')
  revalidatePath('/payments')
  revalidatePath('/customers')
  revalidatePath('/reports/ar-aging')
  revalidatePath('/reports/trial-balance')
  revalidatePath('/accounts')
}

const documentType = z.enum(['INVOICE', 'ESTIMATE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT'])

const receiptSearch = z.object({
  number: z.string().trim().max(40).optional(),
  date: z.string().trim().max(10).optional(),
  amount: z.string().trim().max(20).optional(),
})

export const findSalesReceipts = action
  .requires('invoice:read')
  .input(receiptSearch)
  .handler((ctx, input) => salesService.findReceipts(ctx, input))

export const createDocument = action
  .requires('invoice:create')
  .input(salesDocumentSchema.safeExtend({ type: documentType }))
  .handler(async (ctx, input) => {
    const { type, ...rest } = input
    const document = await salesService.create(ctx, type as SalesDocumentType, rest)
    revalidateSales()
    return document
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
