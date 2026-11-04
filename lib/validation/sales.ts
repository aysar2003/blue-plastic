import { z } from 'zod'

import { settleNumberInput } from '@/lib/money'
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
  /** A purchase line marked billable to this customer, pulled onto the invoice. */
  sourcePurchaseLineId: optionalId,
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
  /** Nature / section of work — printed on quotations and estimates. */
  workScope: optionalText(200),
  /** Place the work is done — printed below Sales person. */
  workSite: optionalText(200),
  depositAccountId: optionalId,
  /** Sales receipt only. Blank is allowed so an older receipt can still be saved. */
  paymentMethod: z
    .union([
      z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'MOBILE_MONEY', 'OTHER']),
      z.literal(''),
    ])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  saveAsDraft: z.coerce.boolean().default(false),
  /**
   * Estimate, quotation, or sales order this sale was built from. Closing the
   * source on save matches QuickBooks linking the two papers.
   */
  convertedFromId: optionalId,
  /** Optional Projects job this sale belongs to. */
  projectId: optionalId,
  /** Optional class. Copied onto every journal line when the document posts. */
  trackingCategoryId: optionalId,
  /**
   * Document currency (ISO). Blank / omitted = organisation base. Amounts on
   * the form are in this currency; the ledger posts base via exchangeRate.
   */
  currencyCode: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .length(3, 'Use a 3-letter ISO currency code'),
      z.literal(''),
    ])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  /** Base units per one unit of document currency. Blank = 1. */
  exchangeRate: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\d{1,12}(\.\d{1,9})?$/, 'Enter an exchange rate'),
      z.literal(''),
    ])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  /**
   * When credit-limit mode is warn, confirm to post past the limit.
   * Hard block ignores this and always refuses.
   */
  acknowledgeCreditLimit: z.coerce.boolean().default(false),
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

/**
 * Turn an estimate, quotation, or sales order into the next document —
 * invoice, sales receipt, or (from a proposal) a sales order. Same link
 * QuickBooks keeps between the papers.
 */
export const convertSalesDocumentSchema = z
  .object({
    id: cuid,
    date: calendarDate,
    target: z.enum(['INVOICE', 'SALES_RECEIPT', 'SALES_ORDER']),
    depositAccountId: optionalId,
  })
  .superRefine((value, ctx) => {
    if (value.target === 'SALES_RECEIPT' && !value.depositAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['depositAccountId'],
        message: 'Choose the account the money was received into.',
      })
    }
  })

/** @deprecated Prefer convertSalesDocumentSchema — kept for older call sites. */
export const convertSalesOrderSchema = convertSalesDocumentSchema

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
  /** Payment currency. Blank = organisation base. */
  currencyCode: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .length(3, 'Use a 3-letter ISO currency code'),
      z.literal(''),
    ])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  /** Base units per 1 unit of payment currency. Blank = 1. */
  exchangeRate: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\d{1,12}(\.\d{1,9})?$/, 'Enter an exchange rate'),
      z.literal(''),
    ])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  /** Set after the same-day payment warning has been accepted. */
  acknowledgeDuplicate: z.coerce.boolean().optional(),
  /** Which invoices this settles, and by how much. */
  applications: z
    .array(z.object({ invoiceId: cuid, amount: moneyString }))
    .max(200)
    .default([]),
})

export type PaymentInput = z.infer<typeof paymentSchema>

export const paymentUpdateSchema = paymentSchema.safeExtend({ id: cuid })

export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>

/** One invoice, same lines, written once for each chosen customer. */
export const batchInvoiceSchema = z.object({
  customerIds: z.array(cuid).min(1, 'Choose at least one customer').max(100),
  date: calendarDate,
  description: optionalText(1000),
  quantity: quantity.default('1'),
  unitPrice: price,
  itemId: cuid,
  taxCodeId: optionalId,
})

export type BatchInvoiceInput = z.infer<typeof batchInvoiceSchema>

export const applyCreditSchema = z.object({
  creditDocumentId: cuid,
  applications: z.array(z.object({ invoiceId: cuid, amount: moneyString })).min(1).max(200),
})

export const voidPaymentSchema = z.object({
  id: cuid,
  reason: requiredText('Reason', 300),
})

/* --- Progress invoicing --------------------------------------------------- */

/**
 * An invoice against an estimate, quotation, or sales order: how much of each
 * line to bill now.
 *
 * Quantities are strings, like every other quantity in the system, so a decimal
 * survives the round trip without going through a float.
 */
export const invoiceFromSourceSchema = z.object({
  sourceId: cuid,
  date: calendarDate,
  reference: optionalText(100),
  memo: optionalText(500),
  lines: z
    .array(
      z.object({
        lineId: cuid,
        /** Blank and "0" both mean "none of this line this time". */
        quantity: z
          .string()
          .trim()
          .transform((value, ctx) => {
            const next = settleNumberInput(value) ?? value
            if (!/^\d{0,12}(\.\d{1,4})?$/.test(next)) {
              ctx.addIssue({ code: 'custom', message: 'Enter a quantity' })
              return z.NEVER
            }
            return next === '' || next === '.' ? '0' : next
          }),
      }),
    )
    .min(1, 'Enter a quantity against at least one line')
    .max(200),
})

export type InvoiceFromSourceInput = z.infer<typeof invoiceFromSourceSchema>
