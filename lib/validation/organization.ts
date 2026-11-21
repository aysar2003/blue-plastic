import { z } from 'zod'

import {
  clampIdleLockSeconds,
  clampSessionMaxHours,
  DEFAULT_IDLE_LOCK_SECONDS,
  DEFAULT_SESSION_MAX_HOURS,
} from '@/lib/desk-security'
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
  paymentBankName: optionalText(120),
  paymentAccountName: optionalText(120),
  paymentAccountNumber: optionalText(80),
  paymentInstructions: optionalText(2000),
  timeZone: requiredText('Time zone', 60),
  localizationPackId: z
    .union([z.enum(['so', 'ke', 'et', 'dj']), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
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

/** Max day allowed per month; February allows 29 (clamped in non-leap years). */
const FISCAL_YEAR_DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

export const fiscalYearStartMonthField = z.coerce.number().int().min(1).max(12)
export const fiscalYearStartDayField = z.coerce.number().int().min(1).max(31)

export function refineFiscalYearStartDay(
  data: { fiscalYearStartMonth: number; fiscalYearStartDay: number },
  ctx: z.RefinementCtx,
) {
  const max = FISCAL_YEAR_DAYS_IN_MONTH[data.fiscalYearStartMonth] ?? 31
  if (data.fiscalYearStartDay > max) {
    ctx.addIssue({
      code: 'custom',
      path: ['fiscalYearStartDay'],
      message: `That month only has ${max} days`,
    })
  }
}

/**
 * Currency and fiscal year are separated from the profile form on purpose: they
 * are ledger-defining settings, and Phase 2 will refuse to change them once a
 * journal exists.
 */
export const organizationAccountingSchema = z
  .object({
    baseCurrency: currencyCode,
    fiscalYearStartMonth: fiscalYearStartMonthField,
    fiscalYearStartDay: fiscalYearStartDayField.default(1),
  })
  .superRefine(refineFiscalYearStartDay)

export type OrganizationAccountingInput = z.infer<typeof organizationAccountingSchema>

/** Desk lock + absolute session logout + 2FA enforce (Settings → Organisation). */
export const organizationSecuritySchema = z.object({
  idleLockSeconds: z.coerce
    .number()
    .int()
    .transform((v) => clampIdleLockSeconds(v))
    .default(DEFAULT_IDLE_LOCK_SECONDS),
  sessionMaxHours: z.coerce
    .number()
    .int()
    .transform((v) => clampSessionMaxHours(v))
    .default(DEFAULT_SESSION_MAX_HOURS),
  enforceTwoFactor: z.enum(['OFF', 'STAFF', 'ALL']).default('OFF'),
})

export type OrganizationSecurityInput = z.infer<typeof organizationSecuritySchema>

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
  creditLimitWarn: boolFlag.default(false),
  payrollStandard: boolFlag.default(true),
  closeHardGates: boolFlag.default(false),
  closeSecondApprover: boolFlag.default(false),
  budgetControlMode: z.enum(['off', 'warn', 'enforce']).default('off'),
  enableTax: boolFlag.default(true),
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
  account: optionalText(64),
})

export const documentTemplateSchema = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a colour'),
  vendorAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a colour').optional(),
  terms: optionalText(2000),
  footerTitle: optionalText(80),
  footerNote: optionalText(2000),
  footerLayout: z.enum(['side', 'bottom', 'band']).default('side'),
  showClassicPaper: boolFlag.default(false),
  paperStyle: z.enum(['merchant', 'trade']).default('merchant'),
  banks: z.array(bankLine).max(6).default([]),
})

export type DocumentTemplateInput = z.infer<typeof documentTemplateSchema>

const formVisibility = z.record(z.string().max(40), z.boolean())

const formOrder = z.array(z.string().trim().min(1).max(40)).max(40).optional()

export const formTemplateBodySchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  layoutId: z.string().trim().max(40).optional(),
  fields: formVisibility,
  columns: formVisibility,
  categoryColumns: formVisibility.optional(),
  fieldOrder: formOrder,
  columnOrder: formOrder,
  categoryColumnOrder: formOrder,
})

export const upsertFormTemplateSchema = z.object({
  family: z.string().regex(/^(sales|purchase):[A-Z0-9_]+$/),
  template: formTemplateBodySchema,
  makeActive: z.boolean().default(true),
})

export type UpsertFormTemplateInput = z.infer<typeof upsertFormTemplateSchema>

export const setActiveFormTemplateSchema = z.object({
  family: z.string().regex(/^(sales|purchase):[A-Z0-9_]+$/),
  templateId: z.string().trim().min(1).max(40),
})

export type SetActiveFormTemplateInput = z.infer<typeof setActiveFormTemplateSchema>

export const deleteFormTemplateSchema = z.object({
  family: z.string().regex(/^(sales|purchase):[A-Z0-9_]+$/),
  templateId: z.string().trim().min(1).max(40),
})

export type DeleteFormTemplateInput = z.infer<typeof deleteFormTemplateSchema>

const boolFlagLoose = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .transform((v) => v === true || v === 'true' || v === 'on')

/** Settings → Organisation → Outgoing email (SMTP / Gmail App Password). */
export const outboundEmailSchema = z.union([
  z.object({ clear: z.literal(true) }),
  z.object({
    clear: z.literal(false).optional(),
    host: requiredText('SMTP host', 200),
    port: z.coerce.number().int().min(1).max(65535),
    secure: boolFlagLoose.default(true),
    user: email,
    from: z
      .union([email, z.literal('')])
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    /** Blank keeps the previously saved password. */
    password: z.string().max(200).optional(),
  }),
])

export type OutboundEmailInput = z.infer<typeof outboundEmailSchema>

export const sendDocumentEmailSchema = z.object({
  to: email,
  subject: requiredText('Subject', 200),
  body: z.string().trim().max(10_000).default(''),
  filename: requiredText('Filename', 200),
  /** Base64 of the PDF or Excel attachment. */
  contentBase64: z.string().min(1, 'Attachment is required').max(12_000_000),
  contentType: z.string().trim().min(1).max(120).default('application/pdf'),
})

export type SendDocumentEmailInput = z.infer<typeof sendDocumentEmailSchema>

export const testOutboundEmailSchema = z.object({
  to: email,
})

export type TestOutboundEmailInput = z.infer<typeof testOutboundEmailSchema>
