import { z } from 'zod'

import { calculatedDecimal, calendarDate, chosenNumber, cuid, optionalText } from './common'

const quantity = calculatedDecimal(/^-?\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity')

export const inventoryAdjustmentSchema = z.object({
  number: chosenNumber,
  date: calendarDate,
  /** count = what was found. damage = quantity lost, cost stays on the item. cost = add value. */
  mode: z.enum(['count', 'damage', 'cost']).default('count'),
  /** Blank means Inventory Shrinkage, which is where a difference normally goes. */
  accountId: z
    .union([cuid, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  reason: optionalText(300),
  memo: optionalText(1000),
  lines: z
    .array(
      z.object({
        itemId: cuid,
        countedQuantity: quantity,
        /** Only used when stock is being added and its cost is known. */
        unitCost: z
          .union([z.string().trim().regex(/^\d{1,15}(\.\d{1,6})?$/), z.literal('')])
          .transform((v) => (v === '' ? null : v))
          .nullable()
          .optional(),
        description: optionalText(300),
      }),
    )
    .min(1, 'Add at least one item')
    .max(500),
})

export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>

export const storeTransferSchema = z
  .object({
    number: chosenNumber,
    date: calendarDate,
    fromStoreId: cuid,
    toStoreId: cuid,
    itemId: cuid,
    quantity: calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity').refine(
      (v) => Number(v) > 0,
      'Quantity must be more than zero',
    ),
    memo: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if (value.fromStoreId === value.toStoreId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toStoreId'],
        message: 'Choose a different store to send the stock to.',
      })
    }
  })

export type StoreTransferInput = z.infer<typeof storeTransferSchema>

export const storeTicketSchema = z
  .object({
    number: chosenNumber,
    date: calendarDate,
    storeId: cuid,
    toStoreId: cuid,
    takenBy: optionalText(120),
    memo: optionalText(1000),
    lines: z
      .array(
        z.object({
          itemId: cuid,
          quantity: calculatedDecimal(/^\d{1,12}(\.\d{1,4})?$/, 'Enter a quantity').refine(
            (v) => Number(v) > 0,
            'Quantity must be more than zero',
          ),
        }),
      )
      .min(1, 'Add at least one item')
      .max(200),
  })
  .superRefine((value, ctx) => {
    if (value.storeId === value.toStoreId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toStoreId'],
        message: 'Choose a different store to send the stock to.',
      })
    }
    const seen = new Set<string>()
    for (const [index, line] of value.lines.entries()) {
      if (seen.has(line.itemId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', index, 'itemId'],
          message: 'This item is already on the ticket. Combine the quantities on one line.',
        })
      }
      seen.add(line.itemId)
    }
  })

export type StoreTicketInput = z.infer<typeof storeTicketSchema>

export const negativeStockSchema = z.object({
  allowNegativeStock: z.coerce.boolean(),
})

