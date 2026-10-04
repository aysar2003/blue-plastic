'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  inventoryAdjustmentSchema,
  negativeStockSchema,
  storeTicketSchema,
  storeTransferSchema,
} from '@/lib/validation/inventory'
import { deleteRecordSchema } from '@/lib/validation/common'
import { action } from '@/server/action'
import { requestMeta, writeAudit } from '@/server/audit'
import { db } from '@/server/db'
import * as inventoryService from '@/server/services/inventory.service'
import * as storeService from '@/server/services/store.service'

export const createAdjustment = action
  .requires('inventory:adjust')
  .input(inventoryAdjustmentSchema)
  .handler(async (ctx, input) => {
    const adjustment = await inventoryService.createAdjustment(ctx, input)
    revalidatePath('/inventory/stock')
    revalidatePath('/accounts')
    revalidatePath('/reports/trial-balance')
    return adjustment
  })

/**
 * Delete a stock adjustment.
 *
 * The stock it moved goes back and its journal is withdrawn. A count entered
 * against the wrong item had no way back before this.
 */
export const deleteAdjustment = action
  .requires('inventory:adjust')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    const result = await inventoryService.removeAdjustment(ctx, input.id, input.reason)
    revalidatePath('/inventory/stock')
    revalidatePath('/accounts')
    revalidatePath('/journals')
    revalidatePath('/reports/trial-balance')
    return result
  })

export const setNegativeStockPolicy = action
  .requires('org:update')
  .input(negativeStockSchema)
  .handler(async (ctx, input) => {
    const meta = await requestMeta()

    await db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: ctx.orgId },
        data: { allowNegativeStock: input.allowNegativeStock },
      })
      await writeAudit(
        tx,
        ctx,
        {
          entity: 'Organization',
          entityId: ctx.orgId,
          action: 'UPDATE',
          after: { allowNegativeStock: input.allowNegativeStock },
        },
        meta,
      )
    })

    revalidatePath('/inventory/stock')
    revalidatePath('/settings/organization')
    return { allowNegativeStock: input.allowNegativeStock }
  })

const storeDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Give the store a name.').max(120),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  keyHolderName: z.string().trim().max(120).optional().or(z.literal('')),
  keyHolderPhone: z.string().trim().max(40).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

export const createStore = action
  .requires('account:create')
  .input(storeDetailsSchema)
  .handler(async (ctx, input) => {
    const store = await storeService.create(ctx, input)
    revalidatePath('/stores')
    revalidatePath('/inventory/stores')
    revalidatePath('/accounts')
    revalidatePath('/items')
    return store
  })

export const updateStore = action
  .requires('account:create')
  .input(storeDetailsSchema.extend({ id: z.string().min(1) }))
  .handler(async (ctx, input) => {
    const { id, ...details } = input
    const store = await storeService.update(ctx, id, details)
    revalidatePath('/stores')
    revalidatePath(`/stores/${id}`)
    revalidatePath('/inventory/stores')
    revalidatePath('/accounts')
    revalidatePath('/items')
    return store
  })

export async function saveAdjustmentForm(_prev: FormState, formData: FormData): Promise<FormState> {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? '{}'))
  } catch {
    return { status: 'error', message: 'The adjustment could not be read. Please try again.' }
  }

  const result = await createAdjustment(parsed)
  return toFormState(
    result,
    result.ok && 'number' in result.data ? `${result.data.number} posted.` : 'Posted.',
  )
}

export const createStoreTransfer = action
  .requires('inventory:adjust')
  .input(storeTransferSchema)
  .handler(async (ctx, input) => {
    const transfer = await inventoryService.createStoreTransfer(ctx, input)
    revalidatePath('/stores')
    revalidatePath(`/stores/${input.fromStoreId}`)
    revalidatePath(`/stores/${input.toStoreId}`)
    revalidatePath('/inventory/stock')
    revalidatePath(`/inventory/${input.itemId}`)
    revalidatePath(`/items/${input.itemId}/report`)
    revalidatePath('/accounts')
    return transfer
  })

export async function saveStoreTransferForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await createStoreTransfer(formValues(formData))
  return toFormState(
    result,
    result.ok && 'ticketNumber' in result.data
      ? `${result.data.number} transferred · ticket ${result.data.ticketNumber}.`
      : result.ok && 'number' in result.data
        ? `${result.data.number} transferred.`
        : 'Transferred.',
  )
}

export const createStoreTicket = action
  .requires('inventory:adjust')
  .input(storeTicketSchema)
  .handler(async (ctx, input) => {
    const ticket = await inventoryService.createStoreTicket(ctx, input)
    revalidatePath('/stores')
    revalidatePath(`/stores/${input.storeId}`)
    revalidatePath(`/stores/${input.toStoreId}`)
    revalidatePath('/inventory/stock')
    revalidatePath(`/inventory/${input.itemId}`)
    revalidatePath(`/items/${input.itemId}/report`)
    revalidatePath('/accounts')
    return ticket
  })

export async function saveStoreTicketForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await createStoreTicket(formValues(formData))
  return toFormState(
    result,
    result.ok && 'number' in result.data ? `Ticket ${result.data.number} posted.` : 'Ticket posted.',
  )
}
