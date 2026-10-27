import { z } from 'zod'

import {
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  type ModuleFlag,
} from '@/lib/feature-flags'

const boolFlag = z
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on'), z.literal('off')])
  .transform((v) => v === true || v === 'true' || v === 'on')

export const rentPaymentMethods = ['EVC', 'ZAAD', 'EDAHAB', 'BANK'] as const
export type RentPaymentMethodInput = (typeof rentPaymentMethods)[number]

export const rentPaymentMethodSchema = z.enum(rentPaymentMethods)

const moneyAmount = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())
    if (!Number.isFinite(n) || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter a payment amount greater than zero.' })
      return z.NEVER
    }
    return Math.round(n * 10000) / 10000
  })

export const submitRentPaymentSchema = z.object({
  planId: z.string().min(1, 'Choose a plan.'),
  method: rentPaymentMethodSchema,
  amount: moneyAmount,
  reference: z
    .string()
    .trim()
    .min(3, 'Enter the transaction reference.')
    .max(120),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === '' ? null : v)),
})

export type SubmitRentPaymentInput = z.infer<typeof submitRentPaymentSchema>

export const reviewRentPaymentSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(['confirm', 'reject']),
  note: z
    .string()
    .trim()
    .max(400)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === '' ? null : v)),
})

export type ReviewRentPaymentInput = z.infer<typeof reviewRentPaymentSchema>

const companyModulesFields = Object.fromEntries(
  MODULE_FLAGS.map((key) => [MODULE_FORM_KEYS[key], boolFlag.optional()]),
) as Record<(typeof MODULE_FORM_KEYS)[ModuleFlag], z.ZodOptional<typeof boolFlag>>

export const upsertPlatformPlanSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1, 'Plan name is required.').max(80),
    months: z.coerce.number().int().min(1).max(60),
    price: moneyAmount,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase())
      .default('USD'),
    maxUsers: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((v) => {
        if (v == null || v === '') return null
        const n = typeof v === 'number' ? v : Number(v)
        if (!Number.isFinite(n) || n < 0) return null
        if (n === 0) return null
        return Math.min(500, Math.floor(n))
      }),
    active: boolFlag.default(true),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    ...companyModulesFields,
  })

export type UpsertPlatformPlanInput = z.infer<typeof upsertPlatformPlanSchema>

export const updateBillingSettingsSchema = z.object({
  evcNumber: z.string().trim().max(40).optional().nullable(),
  zaadNumber: z.string().trim().max(40).optional().nullable(),
  edahabNumber: z.string().trim().max(40).optional().nullable(),
  bankName: z.string().trim().max(80).optional().nullable(),
  bankAccountName: z.string().trim().max(80).optional().nullable(),
  bankAccountNumber: z.string().trim().max(80).optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
})

export type UpdateBillingSettingsInput = z.infer<typeof updateBillingSettingsSchema>

/** Extend rent from max(now, currentExpiry) by N calendar months. */
export function extendRentExpiry(
  currentExpiresAt: Date | string | null | undefined,
  months: number,
  now: Date = new Date(),
): Date {
  const current =
    currentExpiresAt == null
      ? null
      : currentExpiresAt instanceof Date
        ? currentExpiresAt
        : new Date(currentExpiresAt)
  const base =
    current && !Number.isNaN(current.getTime()) && current.getTime() > now.getTime()
      ? new Date(current.getTime())
      : new Date(now.getTime())
  base.setUTCMonth(base.getUTCMonth() + Math.max(1, Math.floor(months)))
  return base
}
