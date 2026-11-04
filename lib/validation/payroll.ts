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
  liabilityAccountId: optionalId,
  payMode: z.enum(['IMMEDIATE', 'ACCRUE']).optional().default('IMMEDIATE'),
  employeeIds: z.array(cuid).max(200).optional().default([]),
})

export const payrollRunIdSchema = z.object({ id: cuid })

export const payrollPostSchema = z.object({
  id: cuid,
  payFromAccountId: optionalId,
  liabilityAccountId: optionalId,
  payMode: z.enum(['IMMEDIATE', 'ACCRUE']).optional(),
  date: calendarDate.optional(),
})

export const payslipIncludeSchema = z.object({
  payslipId: cuid,
  included: z.boolean(),
})

export const payrollReportSchema = z.object({
  from: calendarDate,
  to: calendarDate,
})

export const structureRuleSchema = z.object({
  structureId: cuid,
  code: requiredText('Code', 40),
  name: requiredText('Name', 80),
  kind: z.enum(['EARNING', 'DEDUCTION', 'EMPLOYER']),
  calc: z.enum(['BASE', 'FIXED', 'PERCENT']),
  amount: moneyString,
  expenseAccountId: optionalId,
  liabilityAccountId: optionalId,
})

export const structureCreateSchema = z.object({
  name: requiredText('Name', 80),
  cloneFromId: optionalId,
})

export const structureRuleUpdateSchema = z.object({
  id: cuid,
  name: optionalText(80),
  amount: moneyString.optional(),
  expenseAccountId: optionalId,
  liabilityAccountId: optionalId,
})

export const payrollSettleSchema = z.object({
  id: cuid,
  payFromAccountId: optionalId,
  date: calendarDate.optional(),
})

export const payslipAttendanceSchema = z.object({
  payslipId: cuid,
  workedDaysOverride: z.number().int().min(0).max(366).nullable().optional(),
  workedHoursOverride: z
    .union([moneyString, z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === undefined ? undefined : value)),
  overtimeAmountOverride: z
    .union([moneyString, z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === undefined ? undefined : value)),
})

export const advanceCreateSchema = z.object({
  employeeId: cuid,
  kind: z.enum(['LOAN', 'ADVANCE']),
  label: requiredText('Label', 120),
  amount: moneyString,
  installment: moneyString,
  accountId: optionalId,
})

export const endOfServiceCreateSchema = z.object({
  employeeId: cuid,
  asOf: calendarDate,
  monthsPerYear: moneyString,
  expenseAccountId: optionalId,
  payAccountId: optionalId,
  memo: optionalText(500),
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
