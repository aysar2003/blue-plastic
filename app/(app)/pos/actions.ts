'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  posCashMoveSchema,
  posCheckoutSchema,
  posCloseSessionSchema,
  posCreateQuotationSchema,
  posLoadQuotationSchema,
  posOpenSessionSchema,
  posPaymentMethodSchema,
  posRefundSchema,
  posRegisterSchema,
  posRegisterTransferSchema,
  posUnlockSchema,
} from '@/lib/validation/pos'
import { readRegisterForm } from '@/lib/pos-register-form'
import { action } from '@/server/action'
import { clearRegisterUnlock, grantRegisterUnlock } from '@/server/pos/cashier-unlock'
import * as posService from '@/server/services/pos.service'

function revalidatePos() {
  revalidatePath('/pos')
  revalidatePath('/pos/orders')
  revalidatePath('/pos/quotations')
  revalidatePath('/pos/sessions')
  revalidatePath('/pos/settings')
  revalidatePath('/sales/sales-receipts')
  revalidatePath('/sales/estimates')
  revalidatePath('/accounts')
  revalidatePath('/banking')
}

export const posCheckout = action
  .requires('pos:sell')
  .input(posCheckoutSchema)
  .handler(async (ctx, input) => {
    const result = await posService.checkout(ctx, input)
    revalidatePos()
    return result
  })

export const posCreateQuotation = action
  .requires('invoice:create')
  .input(posCreateQuotationSchema)
  .handler(async (ctx, input) => {
    const result = await posService.createQuotation(ctx, input)
    revalidatePos()
    return result
  })

export const posLoadQuotation = action
  .requires('invoice:read')
  .input(posLoadQuotationSchema)
  .handler(async (ctx, input) => posService.getEstimateCart(ctx, input.estimateId))

export const openPosSession = action
  .requires('pos:sell')
  .input(posOpenSessionSchema)
  .handler(async (ctx, input) => {
    const pin = await posService.assertCashierPin(ctx, input.registerId, input.pin)
    const session = await posService.openSession(ctx, input)
    if (pin.required) await grantRegisterUnlock(ctx.orgId, input.registerId)
    revalidatePos()
    return session
  })

/** Continue Selling: the PIN is checked again, then this browser may sell on this till. */
export const unlockPosRegister = action
  .requires('pos:sell')
  .input(posUnlockSchema)
  .handler(async (ctx, input) => {
    const pin = await posService.assertCashierPin(ctx, input.registerId, input.pin)
    if (pin.required) await grantRegisterUnlock(ctx.orgId, input.registerId)
    return { unlocked: true as const }
  })

/** Drop the unlock when the register list is shown, so the next open asks again. */
export const clearPosRegisterUnlock = action.requires('pos:read').handler(async () => {
  await clearRegisterUnlock()
  return { cleared: true as const }
})

export const closePosSession = action
  .requires('pos:sell')
  .input(posCloseSessionSchema)
  .handler(async (ctx, input) => {
    const session = await posService.closeSession(ctx, input)
    revalidatePos()
    return session
  })

export const recordPosCashMove = action
  .requires('pos:sell')
  .input(posCashMoveSchema)
  .handler(async (ctx, input) => {
    const move = await posService.recordCashMove(ctx, input)
    revalidatePos()
    return move
  })

export const transferPosRegister = action
  .requires('pos:read')
  .input(posRegisterTransferSchema)
  .handler(async (ctx, input) => {
    const result = await posService.transferFromRegister(ctx, input)
    revalidatePos()
    return result
  })

export const posRefund = action
  .requires('pos:sell')
  .input(posRefundSchema)
  .handler(async (ctx, input) => {
    const result = await posService.refundOrder(ctx, input)
    revalidatePos()
    revalidatePath('/sales/refunds')
    return result
  })

export const savePosPaymentMethod = action
  .requires('pos:manage')
  .input(posPaymentMethodSchema)
  .handler(async (ctx, input) => {
    await posService.upsertPaymentMethod(ctx, input)
    revalidatePos()
    return { saved: true as const }
  })

export const savePosRegister = action
  .requires('pos:manage')
  .input(posRegisterSchema)
  .handler(async (ctx, input) => {
    await posService.upsertRegister(ctx, input)
    revalidatePos()
    return { saved: true as const }
  })

export async function savePosPaymentMethodForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData)
  return toFormState(
    await savePosPaymentMethod({
      ...values,
      // Unchecked checkboxes are omitted from FormData — treat missing as off.
      isActive: formData.get('isActive') === 'true',
      allowsChangeReturn: formData.get('allowsChangeReturn') === 'true',
    }),
    'Payment method saved.',
  )
}

export async function savePosRegisterForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = readRegisterForm(formData)
  return toFormState(
    await savePosRegister(input),
    input.id ? 'Counter updated.' : 'Counter added.',
  )
}
