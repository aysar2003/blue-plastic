'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'

import {
  organizationAccountingSchema,
  organizationUpdateSchema,
} from '@/lib/validation/organization'
import { action } from '@/server/action'
import * as organizationService from '@/server/services/organization.service'

export const updateOrganization = action
  .requires('org:update')
  .input(organizationUpdateSchema)
  .handler(async (ctx, input) => {
    const org = await organizationService.update(ctx, input)
    revalidatePath('/settings/organization')
    revalidatePath('/', 'layout')
    return org
  })

export const updateAccountingSettings = action
  .requires('org:update')
  .input(organizationAccountingSchema)
  .handler(async (ctx, input) => {
    const org = await organizationService.updateAccountingSettings(ctx, input)
    revalidatePath('/settings/organization')
    revalidatePath('/', 'layout')
    return org
  })

/* --- form adapters ------------------------------------------------------- */

export async function updateOrganizationForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await updateOrganization(formValues(formData))
  return toFormState(result, 'Organisation details saved.')
}

export async function updateAccountingSettingsForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await updateAccountingSettings(formValues(formData))
  return toFormState(result, 'Accounting settings saved.')
}
