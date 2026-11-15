'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  trackingCategoryActiveSchema,
  trackingCategoryRestrictSchema,
  trackingCategorySchema,
} from '@/lib/validation/master-data'
import { action } from '@/server/action'
import * as trackingCategories from '@/server/services/tracking-category.service'

function revalidateClasses() {
  revalidatePath('/settings/classes')
}

export const saveClass = action
  .requires('tax:manage')
  .input(trackingCategorySchema)
  .handler(async (ctx, input) => {
    const row = input.id
      ? await trackingCategories.update(ctx, { ...input, id: input.id })
      : await trackingCategories.create(ctx, input)
    revalidateClasses()
    return { id: row.id }
  })

export const setClassActive = action
  .requires('tax:manage')
  .input(trackingCategoryActiveSchema)
  .handler(async (ctx, input) => {
    await trackingCategories.setActive(ctx, input.id, input.isActive)
    revalidateClasses()
    return { id: input.id }
  })

export async function saveClassForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await saveClass(formValues(formData)), 'Class saved.')
}

export const setRestrictSpending = action
  .requires('tax:manage')
  .input(trackingCategoryRestrictSchema)
  .handler(async (ctx, input) => {
    await trackingCategories.setRestrictSpending(ctx, input.id, input.restrictSpending)
    revalidateClasses()
    return { id: input.id }
  })

export async function setRestrictSpendingForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(
    await setRestrictSpending(formValues(formData)),
    'Fund restriction updated.',
  )
}

export async function setRestrictSpendingAction(formData: FormData) {
  const result = await setRestrictSpending(formValues(formData))
  if (result.ok) revalidateClasses()
}

export async function setClassActiveForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const turningOn = formData.get('isActive') === 'true'
  return toFormState(
    await setClassActive(formValues(formData)),
    turningOn ? 'Class restored.' : 'Class archived.',
  )
}
