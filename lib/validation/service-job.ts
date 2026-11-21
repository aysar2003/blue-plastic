import { z } from 'zod'

import {
  calculatedDecimal,
  calendarDate,
  chosenNumber,
  cuid,
  optionalText,
} from '@/lib/validation/common'

const lineKind = z.enum(['PART', 'LABOR', 'TRAVEL'])

export const serviceJobLineSchema = z.object({
  kind: lineKind,
  itemId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  description: optionalText(500),
  quantity: calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity').refine(
    (v) => Number(v) > 0,
    'Quantity must be more than zero',
  ),
  unitPrice: calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a price'),
  vanStoreId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
})

export const serviceJobSchema = z.object({
  number: chosenNumber,
  date: calendarDate,
  customerId: cuid,
  projectId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  assigneeId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  vanStoreId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  siteLocation: optionalText(200),
  promisedWindowStart: z
    .union([z.literal(''), z.coerce.date()])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  promisedWindowEnd: z
    .union([z.literal(''), z.coerce.date()])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  memo: optionalText(1000),
  lines: z.array(serviceJobLineSchema).min(1, 'Add at least one line'),
})

export type ServiceJobInput = z.infer<typeof serviceJobSchema>

export const scheduleServiceJobSchema = z.object({
  id: cuid,
  scheduledAt: z.coerce.date().optional(),
})