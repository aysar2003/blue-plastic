import { z } from 'zod'

import {
  DOCUMENT_KIND_FORM_KEY_LIST,
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  documentKindsFromFormValues,
  modulesFromFormValues,
  type DocumentKindsFlags,
  type ModuleFlag,
} from '@/lib/feature-flags'
import { countryCode, currencyCode, email, optionalText, requiredText } from './common'

export const organizationUpdateSchema = z.object({
  name: requiredText('Organisation name', 200),
  legalName: optionalText(200),
  taxRegistrationNumber: optionalText(60),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(120),
  region: optionalText(120),
  postalCode: optionalText(30),
  country: countryCode,
  phone: optionalText(40),
  email: z.union([email, z.literal('')]).transform((v) => (v === '' ? null : v)).nullable().optional(),
  website: optionalText(200),
  timeZone: requiredText('Time zone', 60),
})

export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>

/** Shell mark (1–4 letters/digits). Empty clears the override so initials are used. */
export const organizationBrandingSchema = z.object({
  brandMark: z
    .string()
    .trim()
    .max(4, 'Use at most 4 characters')
    .regex(/^[A-Za-z0-9]*$/, 'Letters and numbers only')
    .transform((v) => (v ? v.toUpperCase() : null)),
})

export type OrganizationBrandingInput = z.infer<typeof organizationBrandingSchema>

/**
 * Currency and fiscal year are separated from the profile form on purpose: they
 * are ledger-defining settings, and Phase 2 will refuse to change them once a
 * journal exists.
 */
export const organizationAccountingSchema = z.object({
  baseCurrency: currencyCode,
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
})

export type OrganizationAccountingInput = z.infer<typeof organizationAccountingSchema>

const boolFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .transform((v) => v === true || v === 'true' || v === 'on')

const moduleFeatureFields = Object.fromEntries(
  MODULE_FLAGS.map((key) => [MODULE_FORM_KEYS[key], boolFlag.default(true)]),
) as Record<(typeof MODULE_FORM_KEYS)[ModuleFlag], z.ZodDefault<z.ZodType<boolean>>>

const documentKindFeatureFields = Object.fromEntries(
  DOCUMENT_KIND_FORM_KEY_LIST.map((key) => [key, boolFlag.default(true)]),
) as Record<string, z.ZodDefault<z.ZodType<boolean>>>

export const organizationFeaturesSchema = z.object({
  allowJournalDelete: boolFlag.default(true),
  allowCustomerDelete: boolFlag.default(true),
  allowVendorDelete: boolFlag.default(true),
  allowItemDelete: boolFlag.default(true),
  allowAccountDelete: boolFlag.default(true),
  allowDocumentDelete: boolFlag.default(true),
  showCreatorBrand: boolFlag.default(true),
  enableCustomerPortal: boolFlag.default(false),
  enableDocumentApprovals: boolFlag.default(false),
  enableTax: boolFlag.optional(),
  ...moduleFeatureFields,
  ...documentKindFeatureFields,
})

export type OrganizationFeaturesInput = z.infer<typeof organizationFeaturesSchema>

/** Read the modules map from a features form payload. */
export function modulesFromFeaturesInput(
  input: OrganizationFeaturesInput,
): Record<ModuleFlag, boolean> {
  return modulesFromFormValues(input as Record<string, unknown>)
}

/** Read nested document kinds from a features form payload. */
export function documentKindsFromFeaturesInput(
  input: OrganizationFeaturesInput,
): DocumentKindsFlags {
  return documentKindsFromFormValues(input as Record<string, unknown>)
}

const bankLine = z.object({
  name: optionalText(80),
  account: optionalText(40),
})

export const documentTemplateSchema = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a colour'),
  terms: optionalText(2000),
  showClassicPaper: boolFlag.default(false),
  banks: z.array(bankLine).max(6).default([]),
})

export type DocumentTemplateInput = z.infer<typeof documentTemplateSchema>
