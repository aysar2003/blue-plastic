import { z } from 'zod'

import {
  calculatedDecimal,
  calendarDate,
  chosenNumber,
  cuid,
  optionalText,
} from '@/lib/validation/common'

export const workOrderSchema = z.object({
  number: chosenNumber,
  date: calendarDate,
  dueDate: z
    .union([calendarDate, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  itemId: cuid,
  storeId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  quantity: calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity').refine(
    (v) => Number(v) > 0,
    'Quantity must be more than zero',
  ),
  memo: optionalText(1000),
})

export type WorkOrderInput = z.infer<typeof workOrderSchema>
