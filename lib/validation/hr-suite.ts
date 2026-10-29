import { z } from 'zod'

import { cuid, moneyString, optionalText, requiredText } from '@/lib/validation/common'

export const DEVICE_KINDS = ['GENERIC_HTTP', 'ZKTECO', 'ANVIZ', 'OTHER'] as const
export const PUNCH_KINDS = ['IN', 'OUT', 'UNKNOWN'] as const

export const hrSettingsUpdateSchema = z.object({
  hoursPerDay: moneyString,
  workDaysPerWeek: z.coerce.number().int().min(1).max(7),
  overtimeAfterHoursPerDay: moneyString,
  overtimeMultiplier: moneyString,
  timezoneNote: optionalText(80),
})

export const attendanceDeviceCreateSchema = z.object({
  name: requiredText('Device name', 120),
  kind: z.enum(DEVICE_KINDS).optional().default('GENERIC_HTTP'),
  externalKey: requiredText('External key', 120),
  active: z.boolean().optional().default(true),
})

export const attendanceDeviceUpdateSchema = z.object({
  id: cuid,
  name: requiredText('Device name', 120),
  kind: z.enum(DEVICE_KINDS),
  externalKey: requiredText('External key', 120),
  active: z.boolean(),
})

export const attendanceDeviceIdSchema = z.object({ id: cuid })

export const attendanceDeviceUserSchema = z.object({
  deviceId: cuid,
  employeeId: cuid,
  externalUserId: requiredText('Device user id', 80),
})

export const attendanceDeviceUserIdSchema = z.object({ id: cuid })

export const hrBudgetCreateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  name: requiredText('Budget name', 200),
  notes: optionalText(4000),
})

export const hrBudgetIdSchema = z.object({ id: cuid })

export const hrBudgetMonthUpdateSchema = z.object({
  budgetId: cuid,
  month: z.coerce.number().int().min(1).max(12),
  plannedWage: moneyString,
  plannedHeadcount: z.coerce.number().int().min(0).max(100000),
})

export const hrPolicyCreateSchema = z.object({
  title: requiredText('Title', 200),
  body: z.string().max(100_000).optional().default(''),
  published: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().optional().default(0),
})

export const hrPolicyUpdateSchema = hrPolicyCreateSchema.extend({
  id: cuid,
})

export const hrPolicyIdSchema = z.object({ id: cuid })
