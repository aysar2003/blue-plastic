import { z } from 'zod'

import { cuid } from '@/lib/validation/common'

export const budgetCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(2000).optional().nullable(),
  trackingCategoryId: cuid.optional().nullable(),
})

export const budgetIdSchema = z.object({
  id: cuid,
})

export const budgetLineUpsertSchema = z.object({
  budgetId: cuid,
  accountId: cuid,
  month: z.coerce.number().int().min(1).max(12),
  amount: z.string().trim().min(1),
  trackingCategoryId: cuid.optional().nullable(),
})

export const budgetLineIdSchema = z.object({
  lineId: cuid,
})

export const budgetCopySchema = z.object({
  sourceId: cuid,
  name: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  percent: z.coerce.number().min(-100).max(500).optional().default(0),
})

export const budgetImportSchema = z.object({
  budgetId: cuid,
  csv: z.string().min(1),
  commit: z.boolean().default(false),
})
