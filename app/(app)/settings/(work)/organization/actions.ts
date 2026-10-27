'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'

import {
  DOCUMENT_KIND_FORM_KEY_LIST,
  MODULE_FLAGS,
  MODULE_FORM_KEY_LIST,
  type ModuleFlag,
} from '@/lib/feature-flags'
import { requestAppsSchema } from '@/lib/validation/app-access'
import { cuid } from '@/lib/validation/common'
import {
  canManageFormFamily,
  type FormFamilyKey,
  type FormTemplate,
} from '@/lib/form-templates'
import {
  deleteFormTemplateSchema,
  documentTemplateSchema,
  organizationAccountingSchema,
  organizationBrandingSchema,
  organizationFeaturesSchema,
  organizationUpdateSchema,
  outboundEmailSchema,
  setActiveFormTemplateSchema,
  testOutboundEmailSchema,
  upsertFormTemplateSchema,
} from '@/lib/validation/organization'
import { action, fail, ok } from '@/server/action'
import { forbidden, isAppError } from '@/server/errors'
import { clearOrgLogo, storeOrgLogo } from '@/server/files/org-logo'
import { requireOrgContext } from '@/server/auth/context'
import * as appAccessService from '@/server/services/app-access.service'
import * as mailService from '@/server/services/mail.service'
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
    ...DOCUMENT_KIND_FORM_KEY_LIST,
  ] as const
  const values: Record<string, string> = {}
  for (const key of keys) {
    values[key] = formData.get(key) === 'true' || formData.get(key) === 'on' ? 'true' : 'false'
  }
  const result = await updateFeatureFlags(values)
  return toFormState(result, 'Configuration saved.')
}

/** Header Apps power switch — flip one granted module on/off without the full form. */
export const toggleModuleFlag = action
  .requires('org:update')
  .input(
    z.object({
      module: z.enum(MODULE_FLAGS as unknown as [ModuleFlag, ...ModuleFlag[]]),
      enabled: z.boolean(),
    }),
  )
  .handler(async (ctx, input) => {
    const flags = await organizationService.updateModuleEnabled(
      ctx,
      input.module,
      input.enabled,
    )
    revalidatePath('/settings/features')
    revalidatePath('/', 'layout')
    return flags
  })

export const requestMoreApps = action
  .requires('org:update')
  .input(requestAppsSchema)
  .handler(async (ctx, input) => {
    const row = await appAccessService.requestApps(ctx, input)
    revalidatePath('/settings/features')
    revalidatePath('/databases')
    return row
  })

export async function requestMoreAppsForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values: Record<string, string> = { note: String(formData.get('note') ?? '') }
  for (const key of MODULE_FORM_KEY_LIST) {
    values[key] = formData.get(key) === 'true' || formData.get(key) === 'on' ? 'true' : 'false'
  }
  const result = await requestMoreApps(values)
  return toFormState(result, 'App request sent. The system owner will review it.')
}

export const cancelAppAccessRequest = action
  .requires('org:update')
  .input(z.object({ id: cuid }))
  .handler(async (ctx, input) => {
    const row = await appAccessService.cancelPending(ctx, input.id)
    revalidatePath('/settings/features')
    revalidatePath('/databases')
    return row
  })

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

function revalidateFormTemplates() {
  revalidatePath('/sales', 'layout')
  revalidatePath('/purchases', 'layout')
  revalidatePath('/settings/templates')
}

export const upsertFormTemplate = action
  .input(upsertFormTemplateSchema)
  .handler(async (ctx, input) => {
    if (!canManageFormFamily(ctx.permissions, input.family)) throw forbidden()
    const template: FormTemplate = {
      id: input.template.id,
      name: input.template.name,
      layoutId: input.template.layoutId,
      fields: input.template.fields,
      columns: input.template.columns,
      categoryColumns: input.template.categoryColumns,
    }
    const result = await organizationService.upsertFormTemplate(
      ctx,
      input.family as FormFamilyKey,
      template,
      input.makeActive,
    )
    revalidateFormTemplates()
    return result
  })

export const setActiveFormTemplate = action
  .input(setActiveFormTemplateSchema)
  .handler(async (ctx, input) => {
    if (!canManageFormFamily(ctx.permissions, input.family)) throw forbidden()
    const result = await organizationService.setActiveFormTemplate(
      ctx,
      input.family as FormFamilyKey,
      input.templateId,
    )
    revalidateFormTemplates()
    return result
  })

export const deleteFormTemplate = action
  .input(deleteFormTemplateSchema)
  .handler(async (ctx, input) => {
    if (!canManageFormFamily(ctx.permissions, input.family)) throw forbidden()
    const result = await organizationService.deleteFormTemplate(
      ctx,
      input.family as FormFamilyKey,
      input.templateId,
    )
    revalidateFormTemplates()
    return result
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
    vendorAccent: String(formData.get('vendorAccent') ?? ''),
    terms: String(formData.get('terms') ?? ''),
    footerTitle: String(formData.get('footerTitle') ?? ''),
    footerNote: String(formData.get('footerNote') ?? ''),
    footerLayout: String(formData.get('footerLayout') ?? 'side'),
    showClassicPaper: formData.get('showClassicPaper') === 'true' ? 'true' : 'false',
    paperStyle: String(formData.get('paperStyle') ?? 'merchant'),
    banks,
  })
  return toFormState(result, 'Template saved. Invoices and statements use it now.')
}

export const updateOutboundEmail = action
  .requires('org:update')
  .input(outboundEmailSchema)
  .handler(async (ctx, input) => {
    const settings = await mailService.updateOutboundSettings(ctx, input)
    revalidatePath('/settings/organization')
    return settings
  })

export async function updateOutboundEmailForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const clear = formData.get('clear') === 'true' || formData.get('clear') === 'on'
  if (clear) {
    const result = await updateOutboundEmail({ clear: true })
    return toFormState(result, 'Outgoing email disconnected.')
  }
  const result = await updateOutboundEmail({
    host: String(formData.get('host') ?? ''),
    port: String(formData.get('port') ?? ''),
    secure: formData.get('secure') === 'true' || formData.get('secure') === 'on' ? 'true' : 'false',
    user: String(formData.get('user') ?? ''),
    from: String(formData.get('from') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  return toFormState(result, 'Outgoing email saved.')
}

export const testOutboundEmail = action
  .requires('org:update')
  .input(testOutboundEmailSchema)
  .handler(async (ctx, input) => {
    return mailService.sendTestMail(ctx, input.to)
  })

export async function testOutboundEmailForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await testOutboundEmail({ to: String(formData.get('to') ?? '') })
  return toFormState(result, 'Test email sent. Check the inbox.')
}
