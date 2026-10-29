import { z } from 'zod'

import { calendarDate, cuid, moneyString, optionalText, requiredText } from '@/lib/validation/common'

const optionalId = z
  .union([cuid, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

export const payrollRunCreateSchema = z.object({
  periodStart: calendarDate,
  periodEnd: calendarDate,
  memo: optionalText(500),
  payFromAccountId: optionalId,
})

export const payrollRunIdSchema = z.object({ id: cuid })

export const payrollPostSchema = z.object({
  id: cuid,
  payFromAccountId: optionalId,
  date: calendarDate.optional(),
})

/** One-off bonus or deduction on a draft payslip. */
export const payslipAdjustmentSchema = z
  .object({
    payslipId: cuid,
    kind: z.enum(['EARNING', 'DEDUCTION']),
    label: requiredText('Label', 120),
    amount: moneyString,
  })
  .superRefine((value, ctx) => {
    if (!(Number(value.amount) > 0)) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Amount must be greater than zero' })
    }
  })

export const payslipLineIdSchema = z.object({
  id: cuid,
})
