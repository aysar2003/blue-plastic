import { z } from 'zod'

import { calculatedDecimal, calendarDate, chosenNumber, cuid, moneyString, optionalText, requiredText } from './common'

const optionalId = z
  .union([cuid, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const optionalDate = z
  .union([calendarDate, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const quantity = calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity').refine(
  (v) => Number(v) > 0,
  'Quantity must be more than zero',
)

const price = calculatedDecimal(/^\d{1,15}(\.\d{1,4})?$/, 'Enter a price')

export const salesLineSchema = z.object({
  itemId: optionalId,
  description: optionalText(1000),
  quantity: quantity.default('1'),
  /** Blank means "use the item's own price". */
  unitPrice: z.union([price, z.literal('')]).default(''),
  discountPercent: z
    .union([
      z.literal(''),
      calculatedDecimal(/^\d{1,3}(\.\d{1,4})?$/, 'Enter a percent').refine((v) => Number(v) <= 100, 'At most 100%'),
    ])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  taxCodeId: optionalId,
  serviceDate: optionalDate,
  /** The store this line is taken from. Blank means the office when one exists. */
  storeId: optionalId,
})

export const salesDocumentSchema = z.object({
  number: chosenNumber,
  customerId: cuid,
  date: calendarDate,
  paymentTermId: optionalId,
  expiryDate: optionalDate,
  reference: optionalText(60),
  memo: optionalText(1000),
  customerMessage: optionalText(1000),
  depositAccountId: optionalId,
  saveAsDraft: z.coerce.boolean().default(false),
  /** Whole-document discount on an invoice or a sales receipt. Blank means none. */
  discountKind: z.enum(['amount', 'percent']).default('percent'),
  discountValue: z
    .union([
      z.string().trim().regex(/^\d{1,15}(\.\d{1,4})?$/, 'Enter a discount'),
      z.literal(''),
    ])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  lines: z.array(salesLineSchema).min(1, 'Add at least one line').max(200),
}).superRefine((document, ctx) => {
  if (document.discountKind === 'percent' && document.discountValue && Number(document.discountValue) > 100) {
    ctx.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'A percent discount cannot be more than 100.',
    })
  }
})

export type SalesDocumentInput = z.infer<typeof salesDocumentSchema>

export const convertEstimateSchema = z.object({
  id: cuid,
  date: calendarDate,
})

/* --- Payments ------------------------------------------------------------- */

export const paymentSchema = z.object({
  number: chosenNumber,
  customerId: cuid,
  date: calendarDate,
  amount: moneyString.refine((v) => Number(v) > 0, 'Enter an amount greater than zero'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'MOBILE_MONEY', 'OTHER']),
  depositAccountId: cuid,
  reference: optionalText(60),
  memo: optionalText(500),
  /** Which invoices this settles, and by how much. */
  applications: z
    .array(z.object({ invoiceId: cuid, amount: moneyString }))
    .max(200)
    .default([]),
})

export type PaymentInput = z.infer<typeof paymentSchema>

export const applyCreditSchema = z.object({
  creditDocumentId: cuid,
  applications: z.array(z.object({ invoiceId: cuid, amount: moneyString })).min(1).max(200),
})

export const voidPaymentSchema = z.object({
  id: cuid,
  reason: requiredText('Reason', 300),
})
