import { z } from 'zod'

import { DINING_TABLE_STATUSES } from '@/lib/erp/dining-table'
import { cuid, moneyString, optionalText, requiredText } from './common'

export const diningTableUpsertSchema = z.object({
  id: z.string().optional(),
  code: requiredText('Code', 40),
  name: requiredText('Name', 80),
  seats: z.coerce.number().int().min(1).max(50).default(4),
  zone: optionalText(80),
})

export const diningTableStatusSchema = z.object({
  tableId: cuid,
  status: z.enum(DINING_TABLE_STATUSES),
})

export const roomTypeUpsertSchema = z.object({
  id: z.string().optional(),
  name: requiredText('Name', 80),
  baseRateItemId: z.string().optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(20).default(2),
})

export const roomUpsertSchema = z.object({
  id: z.string().optional(),
  roomTypeId: cuid,
  code: requiredText('Code', 40),
  floor: optionalText(40),
})

export const housekeepingSchema = z.object({
  roomId: cuid,
  status: z.enum(['VACANT', 'DIRTY', 'CLEAN', 'OOO']),
})

export const checkInSchema = z.object({
  roomId: cuid,
  customerId: cuid,
  adults: z.coerce.number().int().min(1).max(20).default(1),
  notes: optionalText(500),
})

export const folioChargeSchema = z.object({
  folioId: cuid,
  itemId: cuid,
  description: requiredText('Description', 200),
  quantity: moneyString,
  unitPrice: moneyString,
})

export const checkOutSchema = z.object({
  stayId: cuid,
})

export const nightAuditCloseSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  memo: optionalText(500),
})
