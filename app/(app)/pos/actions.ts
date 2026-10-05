'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { posCheckoutSchema, posPaymentMethodSchema, posRegisterSchema } from '@/lib/validation/pos'
import { action } from '@/server/action'
import * as posService from '@/server/services/pos.service'

function revalidatePos() {
  revalidatePath('/pos')
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
  return toFormState(await savePosPaymentMethod(formValues(formData)), 'Payment method saved.')
}

export async function savePosRegisterForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData)
  const ids = formData.getAll('paymentMethodIds').map(String)
  return toFormState(
    await savePosRegister({ ...values, paymentMethodIds: ids }),
    'Register saved.',
  )
}
