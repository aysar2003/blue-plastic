'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  recurringIdSchema,
  recurringTemplateSchema,
  recurringUpdateSchema,
} from '@/lib/validation/recurring'
import { cuid } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as deferredRevenue from '@/server/services/deferred-revenue.service'
import * as recurringService from '@/server/services/recurring.service'
import { z } from 'zod'

function revalidateSubs(id?: string) {
  revalidatePath('/sales/subscriptions')
  if (id) revalidatePath(`/sales/subscriptions/${id}`)
  revalidatePath('/sales/invoices')
  revalidatePath('/banking/recurring')
}

export const createSubscription = action
  .input(recurringTemplateSchema)
  .handler(async (ctx, input) => {
    if (input.type !== 'INVOICE') {
      throw new Error('Subscriptions must be invoice schedules.')
    }
    const row = await recurringService.create(ctx, input)
    revalidateSubs(row.id)
    return row
  })

export const updateSubscription = action
  .input(recurringUpdateSchema)
  .handler(async (ctx, input) => {
    if (input.type !== 'INVOICE') {
      throw new Error('Subscriptions must be invoice schedules.')
    }
    const { id, ...rest } = input
    const row = await recurringService.update(ctx, id, rest)
    revalidateSubs(row.id)
    return row
  })

export const createSubscriptionInstance = action
  .input(recurringIdSchema)
  .handler(async (ctx, input) => {
    const row = await recurringService.createInstance(ctx, input.id)
    revalidateSubs(input.id)
    return row
  })

export const createDueSubscriptions = action.handler(async (ctx) => {
  const row = await recurringService.createDue(ctx)
  revalidateSubs()
  return row
})

export const recognizeDeferredDue = action.handler(async (ctx) => {
  const row = await deferredRevenue.recognizeDue(ctx)
  revalidateSubs()
  return row
})

export const setSubscriptionActive = action
  .input(z.object({ id: cuid, isActive: z.boolean() }))
  .handler(async (ctx, input) => {
    const row = await recurringService.setActive(ctx, input.id, input.isActive)
    revalidateSubs(row.id)
    return row
  })

export const deleteSubscription = action
  .input(recurringIdSchema)
  .handler(async (ctx, input) => {
    const row = await recurringService.remove(ctx, input.id)
    revalidateSubs()
    return row
  })

export async function createSubscriptionForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData)
  values.type = 'INVOICE'
  const result = await createSubscription(values)
  if (result.ok) redirect(`/sales/subscriptions/${result.data.id}`)
  return toFormState(result, 'Subscription schedule saved.')
}

export async function updateSubscriptionForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData)
  values.type = 'INVOICE'
  const result = await updateSubscription(values)
  if (result.ok) redirect(`/sales/subscriptions/${result.data.id}`)
  return toFormState(result, 'Subscription schedule updated.')
}
