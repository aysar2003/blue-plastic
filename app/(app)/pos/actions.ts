'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  posCashMoveSchema,
  posCheckoutSchema,
  posCloseSessionSchema,
  posOpenSessionSchema,
  posPaymentMethodSchema,
  posRefundSchema,
  posRegisterSchema,
} from '@/lib/validation/pos'
import { readRegisterForm } from '@/lib/pos-register-form'
import { action } from '@/server/action'
import * as posService from '@/server/services/pos.service'

function revalidatePos() {
  revalidatePath('/pos')
  revalidatePath('/pos/orders')
  revalidatePath('/pos/sessions')
  revalidatePath('/pos/settings')
  revalidatePath('/sales/sales-receipts')
  revalidatePath('/accounts')
}

export const posCheckout = action
  .requires('pos:sell')
  .input(posCheckoutSchema)
  .handler(async (ctx, input) => {
    const result = await posService.checkout(ctx, input)
    revalidatePos()
    return result
  })

export const openPosSession = action
  .requires('pos:sell')
  .input(posOpenSessionSchema)
  .handler(async (ctx, input) => {
    const session = await posService.openSession(ctx, input)
    revalidatePos()
    return session
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
    input.id ? 'Register updated.' : 'Register added.',
  )
}
