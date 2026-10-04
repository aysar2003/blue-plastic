import { z } from 'zod'

import { settleNumberInput } from '@/lib/money'

import {
  calendarDate,
  countryCode,
  cuid,
  email as emailSchema,
  moneyString,
  optionalText,
  requiredText,
} from './common'

const optionalId = z
  .union([cuid, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const optionalEmail = z
  .union([emailSchema, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const optionalMoney = z
  .union([moneyString, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const optionalDate = z
  .union([calendarDate, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const optionalTime = z
  .union([z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use a time like 14:30'), z.literal('')])
  .transform((v) => (v === '' ? null : v.slice(0, 5)))
  .nullable()
  .optional()

const reminderDays = z
  .union([z.literal(''), z.literal('3'), z.literal('5'), z.literal('7')])
  .transform((value) => (value === '' ? null : Number(value)))
  .nullable()
  .optional()

/* --- Payment terms -------------------------------------------------------- */

export const paymentTermSchema = z.object({
  id: optionalId,
  name: requiredText('Name', 60),
  type: z.enum(['DUE_ON_RECEIPT', 'NET_DAYS', 'DAY_OF_MONTH']),
  dueDays: z.preprocess(
    (value) => (typeof value === 'string' ? (settleNumberInput(value.trim()) ?? value.trim()) : value),
    z.coerce.number().int().min(0).max(365),
  ),
  discountDays: z
    .union([
      z.literal(''),
      z.preprocess(
        (value) => (typeof value === 'string' ? (settleNumberInput(value.trim()) ?? value.trim()) : value),
        z.coerce.number().int().min(0).max(365),
      ),
    ])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  discountPercent: optionalMoney,
  isDefault: z.coerce.boolean().default(false),
})

export type PaymentTermInput = z.infer<typeof paymentTermSchema>

/* --- Contacts ------------------------------------------------------------- */

const contactBase = {
  displayName: requiredText('Display name', 120),
  companyName: optionalText(160),
  firstName: optionalText(80),
  lastName: optionalText(80),
  email: optionalEmail,
  phone: optionalText(40),
  mobile: optionalText(40),
  taxRegistrationNumber: optionalText(60),
  billingLine1: optionalText(200),
  billingLine2: optionalText(200),
  billingCity: optionalText(120),
  billingRegion: optionalText(120),
  billingPostalCode: optionalText(30),
  billingCountry: countryCode,
  paymentTermId: optionalId,
  notes: optionalText(2000),
}

export const customerSchema = z.object({
  id: optionalId,
  ...contactBase,
  shippingLine1: optionalText(200),
  shippingLine2: optionalText(200),
  shippingCity: optionalText(120),
  shippingRegion: optionalText(120),
  shippingPostalCode: optionalText(30),
  shippingCountry: countryCode,
  creditLimit: optionalMoney,

  /**
   * What the customer owed when the books started. Posts to Accounts Receivable
   * against Opening Balance Equity — never written onto the customer as a number,
   * because a receivable that is not in the ledger is not a receivable.
   */
  openingBalance: optionalMoney,
  openingBalanceDate: optionalDate,
  /** The day the debt agreement was signed. */
  agreementDate: optionalDate,
  /** Clock time of the opening balance. */
  balanceTime: optionalTime,
  /** Days before the balance time that the top warning should appear. */
  reminderDays,
})

export type CustomerInput = z.infer<typeof customerSchema>

export const vendorSchema = z.object({
  id: optionalId,
  ...contactBase,
  defaultExpenseAccountId: optionalId,
  openingBalance: optionalMoney,
  openingBalanceDate: optionalDate,
})

export type VendorInput = z.infer<typeof vendorSchema>

/* --- Items ---------------------------------------------------------------- */

export const itemSchema = z
  .object({
    id: optionalId,
    sku: optionalText(60),
    name: requiredText('Name', 160),
    description: optionalText(1000),
    type: z.enum(['SERVICE', 'NON_INVENTORY', 'INVENTORY']),
    categoryId: optionalId,
    unitOfMeasure: optionalText(20),

    salesDescription: optionalText(1000),
    salesPrice: optionalMoney,
    incomeAccountId: optionalId,
    isTaxable: z.coerce.boolean().default(true),
    salesTaxCodeId: optionalId,

    purchaseDescription: optionalText(1000),
    purchaseCost: optionalMoney,
    expenseAccountId: optionalId,
    purchaseTaxCodeId: optionalId,

    inventoryAccountId: optionalId,
    cogsAccountId: optionalId,
    reorderPoint: optionalMoney,
    storeId: optionalId,

    /**
     * Stock the business already has when the item is created.
     *
     * Recorded as a real opening movement against Opening Balance Equity, not as
     * a number written onto the item — stock only exists where the ledger says
     * it does. Create-only: once the item has a stock history, a change of mind
     * is an adjustment.
     */
    openingQuantity: optionalMoney,
    openingUnitCost: optionalMoney,
    openingDate: optionalDate,
  })
  .superRefine((item, ctx) => {
    // Posting is driven by these mappings, so the rule is stated here as well as
    // in the database — a form should say which field is missing, not quote a
    // constraint name.
    if (!item.incomeAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['incomeAccountId'],
        message: 'Choose the income account this item is sold into',
      })
    }

    if (item.type === 'INVENTORY') {
      if (!item.inventoryAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['inventoryAccountId'],
          message: 'A tracked item needs an inventory account to hold its value',
        })
      }
      if (!item.cogsAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['cogsAccountId'],
          message: 'A tracked item needs a cost of goods sold account',
        })
      }
      // Opening stock has to be valued. Received quantity with no cost has no
      // defensible figure to put in the inventory account.
      if (item.openingQuantity && Number(item.openingQuantity) > 0 && !item.openingUnitCost) {
        ctx.addIssue({
          code: 'custom',
          path: ['openingUnitCost'],
          message: 'Say what the opening stock cost, or leave the quantity blank',
        })
      }
    } else if (item.openingQuantity) {
      ctx.addIssue({
        code: 'custom',
        path: ['openingQuantity'],
        message: 'Only an inventory product carries stock',
      })
    }
  })

export type ItemInput = z.infer<typeof itemSchema>

export const itemCategorySchema = z.object({
  id: optionalId,
  name: requiredText('Name', 120),
  parentId: optionalId,
})

/* --- Tax ------------------------------------------------------------------ */

export const taxAgencySchema = z.object({
  id: optionalId,
  name: requiredText('Name', 120),
  registrationNumber: optionalText(60),
  filingFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']),
})

/**
 * Rates are entered as a percentage because that is how people say them, and
 * stored as a fraction because that is how they are used. The conversion happens
 * once, here, rather than at every call site.
 */
export const percentToFraction = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const next = settleNumberInput(value) ?? value
    if (!/^\d{1,3}(\.\d{1,7})?$/.test(next)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a percentage, for example 16 or 7.5' })
      return z.NEVER
    }
    if (Number(next) > 100) {
      ctx.addIssue({ code: 'custom', message: 'A tax rate cannot exceed 100%' })
      return z.NEVER
    }
    return (Number(next) / 100).toFixed(9)
  })

export const taxRateSchema = z.object({
  id: optionalId,
  name: requiredText('Name', 120),
  percent: percentToFraction,
  agencyId: cuid,
  appliesTo: z.enum(['SALES', 'PURCHASES', 'BOTH']),
  salesAccountId: optionalId,
  purchaseAccountId: optionalId,
})

export type TaxRateInput = z.infer<typeof taxRateSchema>

export const taxCodeSchema = z.object({
  id: optionalId,
  name: requiredText('Name', 120),
  description: optionalText(300),
  isInclusive: z.coerce.boolean().default(false),
  components: z
    .array(
      z.object({
        taxRateId: cuid,
        sequence: z.coerce.number().int().min(1).max(20),
        isCompound: z.coerce.boolean().default(false),
      }),
    )
    .min(1, 'A tax code needs at least one rate')
    .max(10),
})

export type TaxCodeInput = z.infer<typeof taxCodeSchema>

/* --- Shared --------------------------------------------------------------- */

export const setActiveSchema = z.object({
  id: cuid,
  isActive: z.coerce.boolean(),
})

export const bulkSetActiveSchema = z.object({
  ids: z.array(cuid).min(1).max(500),
  isActive: z.coerce.boolean(),
})

export const csvImportSchema = z.object({
  csv: z.string().max(8_000_000).optional(),
  /** Base64 .xlsx, the file QuickBooks Online writes from Export. */
  workbook: z.string().max(12_000_000).optional(),
})
