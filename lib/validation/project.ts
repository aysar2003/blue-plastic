import { z } from 'zod'

import { calendarDate, chosenNumber, cuid, optionalText, requiredText } from './common'

const optionalDate = z
  .union([calendarDate, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'ON_HOLD', 'DONE', 'CANCELLED'] as const
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number]

export const PROJECT_STATUS_LABELS: Record<ProjectStatusValue, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

export const projectSchema = z.object({
  number: chosenNumber,
  name: requiredText('Project name', 200),
  customerId: cuid,
  siteLocation: optionalText(500),
  description: optionalText(4000),
  status: z.enum(PROJECT_STATUSES).default('DRAFT'),
  startDate: optionalDate,
  endDate: optionalDate,
})

export type ProjectInput = z.infer<typeof projectSchema>

export const projectUpdateSchema = projectSchema.extend({
  id: cuid,
})

export const projectStatusSchema = z.object({
  id: cuid,
  status: z.enum(PROJECT_STATUSES),
})

export const projectIdSchema = z.object({
  id: cuid,
})
