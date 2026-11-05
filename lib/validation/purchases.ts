import { z } from 'zod'

import { settleNumberInput } from '@/lib/money'
import { calculatedDecimal, calendarDate, chosenNumber, cuid, moneyString, optionalText } from './common'

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

export const purchaseLineSchema = z.object({
  itemId: optionalId,
  /** Where the cost lands. Required unless an item supplies one. */
  expenseAccountId: optionalId,
  description: optionalText(1000),
  quantity: calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity')
    .refine((v) => Number(v) > 0, 'Quantity must be more than zero')
    .default('1'),
  unitPrice: z.union([z.literal(''), calculatedDecimal(/^\d{1,15}(\.\d{1,4})?$/, 'Enter an amount')]).default(''),
  discountPercent: z
    .union([
      z.literal(''),
      calculatedDecimal(/^\d{1,3}(\.\d{1,4})?$/, 'Enter a percent').refine((v) => Number(v) <= 100, 'At most 100%'),
    ])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  taxCodeId: optionalId,
  /** The store this line is received into. Blank means the office when one exists. */
  storeId: optionalId,
  /** Phase 24: lot / serial for tracked inventory lines. */
  lotNumber: optionalText(80),
  serialNumber: optionalText(80),
  /** Customer to recharge this cost on a later invoice. Blank clears it. */
  billableCustomerId: optionalId,
  /** What to charge the customer. Blank means the line's own amount when pulled. */
  billableUnitPrice: z
    .union([z.literal(''), calculatedDecimal(/^\d{1,15}(\.\d{1,4})?$/, 'Enter a price')])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
})

export const purchaseDocumentSchema = z.object({
  number: chosenNumber,
  /**
   * Required for bills, credits, RFQs and orders. Optional on a purchase
   * request. On an expense settled against a customer, the server may create
   * or reuse a vendor from that customer when this is left blank.
   */
  vendorId: optionalId,
  date: calendarDate,
  paymentTermId: optionalId,
  expiryDate: optionalDate,
  reference: optionalText(60),
  /** IN/ — GRN / internal refs (QuickBooks-style template field). */
  inRef: optionalText(120),
  memo: optionalText(1000),
  paymentAccountId: optionalId,
  /** Settle an expense by crediting this customer's receivable. */
  offsetCustomerId: optionalId,
  /** Optional Projects job this purchase belongs to. */
  projectId: optionalId,
  /** Optional class. Copied onto every journal line when the document posts. */
  trackingCategoryId: optionalId,
  saveAsDraft: z.coerce.boolean().default(false),
  /**
   * Set after the clerk has seen the duplicate-reference warning and chosen
   * to keep the bill. Missing means the warning still applies.
   */
  acknowledgeDuplicate: z.coerce.boolean().optional(),
  lines: z.array(purchaseLineSchema).min(1, 'Add at least one line').max(200),
})

export type PurchaseDocumentInput = z.infer<typeof purchaseDocumentSchema>

/**
 * A posted purchase line is either a product from the item list or a category
 * that names an expense account. Description text and a number, with neither,
 * is not a purchase — it used to post to Uncategorised Expense.
 */
export function unnamedPurchaseLineIndexes(
  lines: { itemId?: string | null; expenseAccountId?: string | null }[],
): number[] {
  return lines.flatMap((line, index) => (line.itemId || line.expenseAccountId ? [] : [index]))
}

export const convertOrderSchema = z.object({ id: cuid, date: calendarDate })

/** PR → RFQ or purchase order, and RFQ → purchase order. An RFQ needs a vendor. */
export const convertPurchaseDocumentSchema = z
  .object({
    id: cuid,
    date: calendarDate,
    target: z.enum(['RFQ', 'PURCHASE_ORDER']),
    vendorId: optionalId,
  })
  .superRefine((value, ctx) => {
    if (value.target === 'RFQ' && !value.vendorId) {
      ctx.addIssue({
        code: 'custom',
        path: ['vendorId'],
        message: 'Choose a vendor for the RFQ.',
      })
    }
  })

export const billPaymentSchema = z.object({
  number: chosenNumber,
  vendorId: cuid,
  date: calendarDate,
  amount: moneyString.refine((v) => Number(v) > 0, 'Enter an amount greater than zero'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'MOBILE_MONEY', 'OTHER']),
  paymentAccountId: cuid,
  reference: optionalText(60),
  memo: optionalText(500),
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
  applications: z.array(z.object({ billId: cuid, amount: moneyString })).max(200).default([]),
})

export type BillPaymentInput = z.infer<typeof billPaymentSchema>

export const applyVendorCreditSchema = z.object({
  creditDocumentId: cuid,
  applications: z.array(z.object({ billId: cuid, amount: moneyString })).min(1).max(200),
})

/* --- Receiving ------------------------------------------------------------ */

/**
 * A goods receipt against a purchase order: how much of each line arrived.
 *
 * Quantities are strings, like every other quantity in the system, so a decimal
 * survives the round trip without going through a float.
 */
export const receiveOrderSchema = z.object({
  orderId: cuid,
  date: calendarDate,
  reference: optionalText(100),
  memo: optionalText(500),
  lines: z
    .array(
      z.object({
        lineId: cuid,
        /** Blank and "0" both mean "none of this line arrived". */
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
        /**
         * Shelf for this line on this receipt. Blank keeps the purchase order's
         * store. Different lines may name different stores on the same receipt.
         */
        storeId: optionalId,
        lotNumber: optionalText(80),
        serialNumber: optionalText(80),
      }),
    )
    .min(1, 'Enter a quantity against at least one line')
    .max(200),
})

export type ReceiveOrderInput = z.infer<typeof receiveOrderSchema>

/**
 * Mark purchase lines as rechargeable to a customer, or clear that mark.
 * A document already settled against a customer (offset) cannot also be billable.
 */
export const markBillableSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: cuid,
        billableCustomerId: optionalId,
        billableUnitPrice: z
          .union([z.literal(''), calculatedDecimal(/^\d{1,15}(\.\d{1,4})?$/, 'Enter a price')])
          .transform((value) => (value === '' ? null : value))
          .nullable()
          .optional(),
      }),
    )
    .min(1, 'Choose at least one line')
    .max(200),
})

export type MarkBillableInput = z.infer<typeof markBillableSchema>
