import { z } from 'zod'

import { calculatedDecimal, cuid, moneyString, optionalText, requiredText } from './common'

const posLine = z.object({
  itemId: cuid,
  quantity: calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity').refine(
    (v) => Number(v) > 0,
    'Quantity must be more than zero',
  ),
})

const posPayment = z.object({
  paymentMethodId: cuid,
  amount: moneyString,
})

export const posCheckoutSchema = z.object({
  registerId: cuid,
  lines: z.array(posLine).min(1, 'Add at least one product').max(100),
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
  paymentMethodIds: z.array(cuid).min(1, 'Pick at least one payment method for this register'),
  isActive: z.coerce.boolean().default(true),
})

export type PosCheckoutInput = z.infer<typeof posCheckoutSchema>
export type PosPaymentMethodInput = z.infer<typeof posPaymentMethodSchema>
export type PosRegisterInput = z.infer<typeof posRegisterSchema>
