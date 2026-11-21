import { z } from 'zod'

import {
  calendarDate,
  chosenNumber,
  cuid,
  moneyString,
  optionalText,
  requiredText,
} from './common'
import { projectBoardStagesSchema } from './project-task'

const optionalMoney = z
  .union([moneyString, z.literal('')])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

const optionalPercent = z
  .union([
    z.literal(''),
    moneyString.refine((v) => Number(v) >= 0 && Number(v) <= 100, 'At most 100%'),
  ])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

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
  storeId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  contractValue: optionalMoney,
  retentionPercent: optionalPercent,
  retainerAmount: optionalMoney,
  budgetAmount: optionalMoney,
  currencyCode: z
    .union([z.string().trim().toUpperCase().length(3), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  /** One stage per line: KEY|Label (e.g. TODO|To do). Blank = built-in four. */
  boardStagesText: z
    .union([z.string(), z.literal('')])
    .optional()
    .transform((raw) => {
      const text = (raw ?? '').trim()
      if (!text) return null
      const stages = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [key, ...rest] = line.split('|')
          return { key: (key ?? '').trim().toUpperCase(), label: rest.join('|').trim() || (key ?? '').trim() }
        })
      return projectBoardStagesSchema.parse(stages)
    }),
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
