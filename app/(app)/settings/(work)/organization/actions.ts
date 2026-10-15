'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'

import { MODULE_FORM_KEY_LIST } from '@/lib/feature-flags'
import {
  documentTemplateSchema,
  organizationAccountingSchema,
  organizationBrandingSchema,
  organizationFeaturesSchema,
  organizationUpdateSchema,
} from '@/lib/validation/organization'
import { action, fail, ok } from '@/server/action'
import { isAppError } from '@/server/errors'
import { clearOrgLogo, storeOrgLogo } from '@/server/files/org-logo'
import { requireOrgContext } from '@/server/auth/context'
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

export const updateOrganizationBranding = action
  .requires('org:update')
  .input(organizationBrandingSchema)
  .handler(async (ctx, input) => {
    const org = await organizationService.updateBranding(ctx, input)
    revalidatePath('/settings/organization')
    revalidatePath('/', 'layout')
    return org
  })

export async function updateOrganizationBrandingForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await updateOrganizationBranding(formValues(formData))
  return toFormState(result, 'Company mark saved.')
}

export async function uploadOrganizationLogoForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const ctx = await requireOrgContext('org:update')
    const file = formData.get('logo')
    if (!(file instanceof File) || file.size === 0) {
      return toFormState(
        fail('VALIDATION', 'Choose a logo image.', { logo: ['Choose a logo image.'] }),
        '',
      )
    }
    await storeOrgLogo(ctx, file)
    revalidatePath('/settings/organization')
    revalidatePath('/', 'layout')
    return toFormState(ok({ uploaded: true }), 'Logo uploaded.')
  } catch (error) {
    if (isAppError(error)) {
      return toFormState(fail(error.code, error.message, error.details), '')
    }
    return toFormState(fail('INTERNAL', 'Could not upload the logo.'), '')
  }
}

export async function clearOrganizationLogoForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  void formData
  try {
    const ctx = await requireOrgContext('org:update')
    await clearOrgLogo(ctx)
    revalidatePath('/settings/organization')
    revalidatePath('/', 'layout')
    return toFormState(ok({ cleared: true }), 'Logo removed.')
  } catch (error) {
    if (isAppError(error)) {
      return toFormState(fail(error.code, error.message, error.details), '')
    }
    return toFormState(fail('INTERNAL', 'Could not remove the logo.'), '')
  }
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
    'allowCustomerDelete',
    'allowVendorDelete',
    'allowItemDelete',
    'allowAccountDelete',
    'allowDocumentDelete',
    'showCreatorBrand',
    'enableCustomerPortal',
    'enableDocumentApprovals',
    ...MODULE_FORM_KEY_LIST,
  ] as const
  const values: Record<string, string> = {}
  for (const key of keys) {
    values[key] = formData.get(key) === 'true' || formData.get(key) === 'on' ? 'true' : 'false'
  }
  const result = await updateFeatureFlags(values)
  return toFormState(result, 'Configuration saved.')
}

export const updateEnableTax = action
  .requires('org:update')
  .input(
    z.object({
      enableTax: z
        .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
        .transform((v) => v === true || v === 'true' || v === 'on'),
    }),
  )
  .handler(async (ctx, input) => {
    const flags = await organizationService.updateEnableTax(ctx, input.enableTax)
    revalidatePath('/settings/tax')
    revalidatePath('/settings/features')
    revalidatePath('/reports/tax-summary')
    revalidatePath('/items')
    revalidatePath('/', 'layout')
    return flags
  })

export async function updateEnableTaxForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const enableTax =
    formData.get('enableTax') === 'true' || formData.get('enableTax') === 'on' ? 'true' : 'false'
  const result = await updateEnableTax({ enableTax })
  return toFormState(
    result,
    enableTax === 'true'
      ? 'Tax is on for this company.'
      : 'Tax is off for this company — it will not show on documents.',
  )
}

export const updateDocumentTemplate = action
  .requires('org:update')
  .input(documentTemplateSchema)
  .handler(async (ctx, input) => {
    const template = await organizationService.updateDocumentTemplate(ctx, input)
    revalidatePath('/settings/templates')
    revalidatePath('/reports/statements/customer')
    revalidatePath('/sales', 'layout')
    return template
  })

export async function updateDocumentTemplateForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const banks = [1, 2, 3, 4, 5, 6].map((index) => ({
    name: String(formData.get(`bank${index}Name`) ?? ''),
    account: String(formData.get(`bank${index}Account`) ?? ''),
  }))
  const result = await updateDocumentTemplate({
    accent: String(formData.get('accent') ?? ''),
    terms: String(formData.get('terms') ?? ''),
    showClassicPaper: formData.get('showClassicPaper') === 'true' ? 'true' : 'false',
    banks,
  })
  return toFormState(result, 'Template saved. Invoices and statements use it now.')
}
