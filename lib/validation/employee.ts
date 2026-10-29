import { z } from 'zod'

import { calendarDate, cuid, email, moneyString, optionalText, requiredText } from '@/lib/validation/common'

export const EMPLOYMENT_TYPES = ['EMPLOYEE', 'CONTRACTOR', 'INTERN'] as const
export const WAGE_TYPES = ['MONTHLY', 'DAILY', 'HOURLY'] as const

const optionalId = z
  .union([cuid, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const optionalEmail = z
  .union([email, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const optionalDate = z
  .union([calendarDate, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const activeFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    return value === true || value === 'true' || value === 'on'
  })

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null
    return value
  })

export const employeeInputSchema = z.object({
  name: requiredText('Name', 200),
  jobTitle: optionalText(120),
  department: optionalText(120),
  photoUrl: optionalUrl,
  workEmail: optionalEmail,
  workPhone: optionalText(40),
  mobile: optionalText(40),
  workStreet: optionalText(200),
  workCity: optionalText(120),
  workCountry: optionalText(120),
  privateStreet: optionalText(200),
  privateCity: optionalText(120),
  privateCountry: optionalText(120),
  emergencyContact: optionalText(200),
  emergencyPhone: optionalText(40),
  skills: optionalText(1000),
  notes: optionalText(4000),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional().default('EMPLOYEE'),
  hiredAt: optionalDate,
  leftAt: optionalDate,
  managerId: optionalId,
  userId: optionalId,
  wageType: z.enum(WAGE_TYPES).optional().default('MONTHLY'),
  wageAmount: moneyString.optional().default('0'),
  expenseAccountId: optionalId,
  payableAccountId: optionalId,
  active: activeFlag,
})

export const employeeCreateSchema = employeeInputSchema

export const employeeUpdateSchema = employeeInputSchema.extend({
  id: cuid,
  /** Optional note when wage amount/type changes — stored on the wage audit row. */
  wageRaiseNote: optionalText(500),
})

export const employeeIdSchema = z.object({ id: cuid })

export const employeeSetActiveSchema = employeeIdSchema.extend({
  active: z
    .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
    .transform((value) => value === true || value === 'true' || value === 'on'),
})

export type EmployeeInput = z.infer<typeof employeeInputSchema>
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>
