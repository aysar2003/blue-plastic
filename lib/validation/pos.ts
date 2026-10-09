import { z } from 'zod'

import { CASHIER_PIN_MAX, CASHIER_PIN_MESSAGE, isCashierPin } from '@/lib/pos-pin'
import { calculatedDecimal, cuid, moneyString, optionalText, requiredText } from './common'

/** Blank means "no change" on edit and "no PIN yet" on create. */
const cashierPin = z
  .string()
  .trim()
  .max(CASHIER_PIN_MAX, `PIN must be ${CASHIER_PIN_MAX} characters or fewer`)
  .refine((value) => value === '' || isCashierPin(value), CASHIER_PIN_MESSAGE)
  .transform((value) => (value === '' ? undefined : value))

const posLine = z.object({
  itemId: cuid,
  quantity: calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity').refine(
    (v) => Number(v) > 0,
    'Quantity must be more than zero',
  ),
  /**
   * Till price for this line. Blank / omitted = item master sales price.
   * Cashiers may override while selling or quoting.
   */
  unitPrice: z
    .union([
      calculatedDecimal(/^\d{1,15}(\.\d{1,4})?$/, 'Enter a price'),
      z.literal(''),
    ])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v)),
  /** Store the goods come from, when the cashier picks one. Blank = automatic. */
  storeId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
})

const posPayment = z.object({
  paymentMethodId: cuid,
  amount: moneyString.refine((value) => Number(value) > 0, 'Each payment must be a positive amount.'),
})

const optionalMethodId = z
  .union([cuid, z.literal('')])
  .transform((value) => (value === '' ? undefined : value))
  .optional()

export const posCheckoutSchema = z.object({
  registerId: cuid,
  sessionId: cuid,
  customerId: cuid.optional(),
  note: optionalText(500),
  lines: z.array(posLine).min(1, 'Add at least one product').max(100),
  /** Gross tendered. Cash may be more than the sale; the difference is change. */
  payments: z.array(posPayment).min(1, 'Choose at least one payment method'),
  /** Required when the tender is more than the sale. Ignored on an exact tender. */
  changeMethodId: optionalMethodId,
  /** When set, this open quotation is closed and linked after the sale posts. */
  estimateId: cuid.optional(),
})

export const posCreateQuotationSchema = z.object({
  registerId: cuid,
  customerId: cuid.optional(),
  note: optionalText(500),
  lines: z.array(posLine).min(1, 'Add at least one product').max(100),
})

export const posLoadQuotationSchema = z.object({
  estimateId: cuid,
})

export const posOpenSessionSchema = z.object({
  registerId: cuid,
  openingCash: moneyString,
  pin: z
    .string()
    .trim()
    .max(CASHIER_PIN_MAX)
    .optional()
    .transform((value) => (value ? value : undefined)),
})

export const posUnlockSchema = z.object({
  registerId: cuid,
  pin: z.string().trim().min(1, 'Enter the PIN.').max(CASHIER_PIN_MAX),
})

export const posCloseSessionSchema = z.object({
  sessionId: cuid,
  closingCash: moneyString,
})

export const posCashMoveSchema = z.object({
  sessionId: cuid,
  kind: z.enum(['IN', 'OUT']),
  amount: moneyString,
  reason: optionalText(500),
})

export const posRefundSchema = z.object({
  registerId: cuid,
  sessionId: cuid,
  orderId: cuid,
  payments: z.array(posPayment).min(1, 'Choose at least one payment method'),
})

export const posPaymentMethodSchema = z.object({
  id: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  name: requiredText('Name', 80),
  ledgerAccountId: cuid,
  isActive: z.coerce.boolean().default(true),
  /** Cashiers may hand change back from this method's account. */
  allowsChangeReturn: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
})

export const posRegisterSchema = z.object({
  id: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  name: requiredText('Name', 80),
  storeId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  defaultCustomerId: cuid,
  paymentMethodIds: z.array(cuid).min(1, 'Pick at least one payment method for this counter'),
  /** Staff who work this counter. Empty = anyone with POS access. */
  staffUserIds: z.array(cuid).default([]),
  isActive: z.coerce.boolean().default(true),
  pin: cashierPin,
  /** Null means the till opens on its cash method. */
  defaultChangeMethodId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  allowWalletChangeReturn: z.boolean().default(true),
  /**
   * Methods on this till that may return change. Omitted means every method on
   * the till may — that is how a till saved before this setting behaves.
   */
  changeMethodIds: z.array(cuid).optional(),
})

export type PosCheckoutInput = z.infer<typeof posCheckoutSchema>
export type PosCreateQuotationInput = z.infer<typeof posCreateQuotationSchema>
export type PosLoadQuotationInput = z.infer<typeof posLoadQuotationSchema>
export type PosOpenSessionInput = z.infer<typeof posOpenSessionSchema>
export type PosUnlockInput = z.infer<typeof posUnlockSchema>
export type PosCloseSessionInput = z.infer<typeof posCloseSessionSchema>
export type PosCashMoveInput = z.infer<typeof posCashMoveSchema>
export type PosRefundInput = z.infer<typeof posRefundSchema>
export type PosPaymentMethodInput = z.infer<typeof posPaymentMethodSchema>
export type PosRegisterInput = z.infer<typeof posRegisterSchema>
