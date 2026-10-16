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
import * as recurringService from '@/server/services/recurring.service'
import { z } from 'zod'

function revalidateRecurring(id?: string) {
  revalidatePath('/banking/recurring')
  if (id) revalidatePath(`/banking/recurring/${id}`)
  revalidatePath('/purchases')
  revalidatePath('/journals')
}

/** Permission is checked per type inside the service (journal:post or bill:create). */
export const createRecurring = action
  .input(recurringTemplateSchema)
  .handler(async (ctx, input) => {
    const row = await recurringService.create(ctx, input)
    revalidateRecurring(row.id)
    return row
  })

export const updateRecurring = action
  .input(recurringUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await recurringService.update(ctx, id, rest)
    revalidateRecurring(row.id)
    return row
  })

export const createRecurringInstance = action
  .input(recurringIdSchema)
  .handler(async (ctx, input) => {
    const row = await recurringService.createInstance(ctx, input.id)
    revalidateRecurring(input.id)
    return row
  })

export const createDueRecurring = action.handler(async (ctx) => {
  const row = await recurringService.createDue(ctx)
  revalidateRecurring()
  return row
})

export const setRecurringActive = action
  .input(z.object({ id: cuid, isActive: z.boolean() }))
  .handler(async (ctx, input) => {
    const row = await recurringService.setActive(ctx, input.id, input.isActive)
    revalidateRecurring(row.id)
    return row
  })

export const deleteRecurring = action
  .input(recurringIdSchema)
  .handler(async (ctx, input) => {
    const row = await recurringService.remove(ctx, input.id)
    revalidateRecurring()
    return row
  })

export async function createRecurringForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await createRecurring(formValues(formData))
  if (result.ok) redirect(`/banking/recurring/${result.data.id}`)
  return toFormState(result, 'Recurring transaction saved.')
}

export async function updateRecurringForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(await updateRecurring(formValues(formData)), 'Recurring transaction updated.')
}
