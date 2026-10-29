import { z } from 'zod'

import { calendarDate, cuid, moneyString, optionalText, requiredText } from '@/lib/validation/common'

const activeFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    return value === true || value === 'true' || value === 'on'
  })

const paidFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .optional()
  .transform((value) => value === true || value === 'true' || value === 'on')

export const leaveTypeCreateSchema = z.object({
  name: requiredText('Name', 120),
  paid: paidFlag.default(true),
  daysPerYear: moneyString.optional().default('0'),
  active: activeFlag,
})

export const leaveTypeUpdateSchema = leaveTypeCreateSchema.extend({
  id: cuid,
})

export const leaveTypeIdSchema = z.object({ id: cuid })

export const leaveAllocationSchema = z.object({
  employeeId: cuid,
  leaveTypeId: cuid,
  year: z.coerce.number().int().min(2000).max(2100),
  entitledDays: moneyString,
})

export const leaveRequestCreateSchema = z.object({
  employeeId: cuid,
  leaveTypeId: cuid,
  dateFrom: calendarDate,
  dateTo: calendarDate,
  days: moneyString.optional(),
  reason: optionalText(2000),
})

export const leaveRequestDecideSchema = z.object({
  id: cuid,
  approve: z
    .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
    .transform((value) => value === true || value === 'true' || value === 'on'),
  decisionNote: optionalText(2000),
})

export const leaveRequestIdSchema = z.object({ id: cuid })
