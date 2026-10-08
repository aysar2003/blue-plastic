'use server'

import { revalidatePath } from 'next/cache'
import type { PurchaseDocumentType } from '@prisma/client'
import { z } from 'zod'

import { toFormState, type FormState } from '@/components/forms/action-state'
import { cuid, deleteRecordSchema } from '@/lib/validation/common'
import {
  applyVendorCreditSchema,
  billPaymentSchema,
  convertOrderSchema,
  purchaseDocumentSchema,
  receiveOrderSchema,
} from '@/lib/validation/purchases'
import { requireOrgContext } from '@/server/auth/context'
import { action } from '@/server/action'
import * as billPaymentService from '@/server/services/bill-payment.service'
import * as purchaseService from '@/server/services/purchase.service'
import { assertDocumentDeleteAllowed } from '@/server/feature-guards'

function revalidatePurchases() {
  for (const slug of ['bills', 'expenses', 'vendor-credits', 'purchase-orders']) {
    revalidatePath(`/purchases/${slug}`)
  }
  revalidatePath('/bill-payments')
  revalidatePath('/vendors')
  revalidatePath('/reports/ap-aging')
  revalidatePath('/reports/trial-balance')
  revalidatePath('/accounts')
}

const documentType = z.enum(['BILL', 'EXPENSE', 'VENDOR_CREDIT', 'PURCHASE_ORDER'])

export const createPurchase = action
  .requires('bill:create')
  .input(purchaseDocumentSchema.safeExtend({ type: documentType }))
  .handler(async (ctx, input) => {
    const { type, ...rest } = input
    const document = await purchaseService.create(ctx, type as PurchaseDocumentType, rest)
    revalidatePurchases()
    return document
  })

export const updatePurchase = action
  .requires('bill:update')
  .input(purchaseDocumentSchema.safeExtend({ id: cuid }))
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const document = await purchaseService.update(ctx, id, rest)
    revalidatePurchases()
    return document
  })

/** Delete a bill, expense, vendor credit or purchase order. */
export const deletePurchase = action
  .requires('bill:void')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    assertDocumentDeleteAllowed(ctx)
    const document = await purchaseService.remove(ctx, input.id, input.reason)
    revalidatePurchases()
    revalidatePath('/inventory/stock')
    revalidatePath('/reports')
    return document
  })

export const convertOrder = action
  .requires('bill:create')
  .input(convertOrderSchema)
  .handler(async (ctx, input) => {
    const bill = await purchaseService.convertOrder(ctx, input.id, input.date)
    revalidatePurchases()
    return bill
  })

/**
 * Book a delivery in against a purchase order.
 *
 * Guarded by `bill:create` rather than a receiving permission of its own,
 * because that is precisely what it does: it raises a bill for what arrived.
 */
export const receiveOrder = action
  .requires('bill:create')
  .input(receiveOrderSchema)
  .handler(async (ctx, input) => {
    const bill = await purchaseService.receiveOrder(ctx, input)
    revalidatePurchases()
    revalidatePath('/inventory/stock')
    revalidatePath(`/purchases/purchase-orders/${input.orderId}`)
    return bill
  })

export const createBillPayment = action
  .requires('expense:create')
  .input(billPaymentSchema)
  .handler(async (ctx, input) => {
    const payment = await billPaymentService.create(ctx, input)
    revalidatePurchases()
    return payment
  })

export const applyVendorCredit = action
  .requires('expense:create')
  .input(applyVendorCreditSchema)
  .handler(async (ctx, input) => {
    const credit = await billPaymentService.applyCredit(ctx, input.creditDocumentId, input.applications)
    revalidatePurchases()
    return credit
  })

export const deleteBillPayment = action
  .requires('expense:void')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    assertDocumentDeleteAllowed(ctx)
    const payment = await billPaymentService.remove(ctx, input.id, input.reason)
    revalidatePurchases()
    return payment
  })

/**
 * What a vendor has outstanding, for the payment screen.
 *
 * Bills and credits come back together in one round trip: they are the two ways
 * a bill gets settled, and fetching them separately would show the bills first
 * and the credits a moment later, which is exactly when somebody pays cash for
 * something a credit already covers.
 */
export async function vendorPayables(vendorId: string) {
  const ctx = await requireOrgContext('expense:create')
  const parsed = z.object({ vendorId: cuid }).safeParse({ vendorId })
  if (!parsed.success) return { bills: [], credits: [] }

  const [bills, credits] = await Promise.all([
    billPaymentService.openBillsFor(ctx, parsed.data.vendorId),
    billPaymentService.openCreditsFor(ctx, parsed.data.vendorId),
  ])

  return {
    bills: bills.map((bill) => ({
      id: bill.id,
      number: bill.number,
      reference: bill.reference,
      date: bill.date.toISOString(),
      dueDate: bill.dueDate?.toISOString() ?? null,
      total: bill.total,
      paid: bill.paid,
      balance: bill.balance,
      daysOverdue: bill.daysOverdue,
    })),
    credits: credits.map((credit) => ({
      id: credit.id,
      number: credit.number,
      date: credit.date.toISOString(),
      remaining: credit.remaining,
    })),
  }
}

/* --- Form adapters -------------------------------------------------------- */

export async function savePurchaseForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The document could not be read. Please try again.' }
  }

  const result = parsed.id ? await updatePurchase(parsed) : await createPurchase(parsed)
  return toFormState(
    result,
    result.ok && 'number' in result.data ? `${result.data.number} saved.` : 'Saved.',
  )
}

/**
 * The receiving form posts JSON: its line grid is an array, and flattening then
 * re-parsing it would only invent a chance to lose a line.
 */
export async function receiveOrderForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The receipt could not be read. Please try again.' }
  }

  const result = await receiveOrder(parsed)
  return toFormState(
    result,
    result.ok && 'number' in result.data
      ? `Received on bill ${result.data.number}. ${
          result.data.orderStatus === 'CLOSED'
            ? `${result.data.orderNumber} is now complete.`
            : `${result.data.orderNumber} still has items outstanding.`
        }`
      : 'Receipt recorded.',
  )
}

export async function saveBillPaymentForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The payment could not be read. Please try again.' }
  }

  const result = await createBillPayment(parsed)
  return toFormState(
    result,
    result.ok && 'number' in result.data ? `Payment ${result.data.number} recorded.` : 'Recorded.',
  )
}
