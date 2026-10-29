import { z } from 'zod'

import { calendarDate, cuid, moneyString, optionalText, requiredText } from '@/lib/validation/common'

export const CONTRACT_STATES = ['DRAFT', 'OPEN', 'EXPIRED', 'CANCELLED'] as const
export const DOCUMENT_KINDS = ['CONTRACT', 'ID', 'CERTIFICATE', 'OTHER'] as const
export const WAGE_TYPES = ['MONTHLY', 'DAILY', 'HOURLY'] as const

const optionalDate = z
  .union([calendarDate, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

export const employeeContractCreateSchema = z.object({
  employeeId: cuid,
  name: requiredText('Contract name', 200),
  dateStart: calendarDate,
  dateEnd: optionalDate,
  wageType: z.enum(WAGE_TYPES).optional().default('MONTHLY'),
  wageAmount: moneyString.optional().default('0'),
  jobTitle: optionalText(120),
  notes: optionalText(4000),
  state: z.enum(CONTRACT_STATES).optional().default('DRAFT'),
})

export const employeeContractUpdateSchema = employeeContractCreateSchema.extend({
  id: cuid,
})

export const employeeContractIdSchema = z.object({ id: cuid })

export const employeeContractSetStateSchema = z.object({
  id: cuid,
  state: z.enum(CONTRACT_STATES),
  /** When opening a contract, copy wage onto the employee card. */
  syncWage: z
    .union([z.literal('true'), z.literal('false'), z.literal('on'), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true' || value === 'on'),
})

export const employeeDocumentCreateSchema = z.object({
  employeeId: cuid,
  kind: z.enum(DOCUMENT_KINDS).optional().default('OTHER'),
  title: requiredText('Title', 200),
  notes: optionalText(2000),
})

export const employeeDocumentIdSchema = z.object({
  employeeId: cuid,
  id: cuid,
})
