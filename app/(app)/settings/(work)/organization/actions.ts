'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'

import {
  organizationAccountingSchema,
  organizationFeaturesSchema,
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

export const updateFeatureFlags = action
  .requires('org:update')
  .input(organizationFeaturesSchema)
  .handler(async (ctx, input) => {
    const flags = await organizationService.updateFeatureFlags(ctx, input)
    revalidatePath('/settings/features')
    revalidatePath('/', 'layout')
    return flags
  })

export async function updateFeatureFlagsForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Unchecked boxes are omitted — treat missing as off.
  const keys = [
    'allowJournalDelete',
    'allowContactDelete',
    'allowDocumentDelete',
    'showCreatorBrand',
    'moduleSales',
    'modulePurchases',
    'moduleBanking',
    'moduleInventory',
    'modulePos',
    'moduleAccounting',
    'moduleReports',
  ] as const
  const values: Record<string, string> = {}
  for (const key of keys) {
    values[key] = formData.get(key) === 'true' || formData.get(key) === 'on' ? 'true' : 'false'
  }
  const result = await updateFeatureFlags(values)
  return toFormState(result, 'Configuration saved.')
}
