'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { toFormState, type FormState } from '@/components/forms/action-state'
import {
  inventoryAdjustmentSchema,
  negativeStockSchema,
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

export const createStore = action
  .requires('account:create')
  .input(z.object({ name: z.string().trim().min(1, 'Give the store a name.').max(120) }))
  .handler(async (ctx, input) => {
    const store = await storeService.create(ctx, input.name)
    revalidatePath('/stores')
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
