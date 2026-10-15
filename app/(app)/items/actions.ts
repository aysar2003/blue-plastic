'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { z } from 'zod'

import { cuid, deleteRecordSchema } from '@/lib/validation/common'
import { bulkSetActiveSchema, csvImportSchema, itemSchema } from '@/lib/validation/master-data'
import { action } from '@/server/action'
import { assertItemDeleteAllowed } from '@/server/feature-guards'
import { importItems } from '@/server/services/import.service'
import * as itemService from '@/server/services/item.service'
import * as lifecycle from '@/server/services/master-data-lifecycle'

export const createItem = action
  .requires('item:create')
  .input(itemSchema)
  .handler(async (ctx, input) => {
    const item = await itemService.create(ctx, input)
    revalidatePath('/items')
    return { id: item.id, name: item.name }
  })

export const updateItem = action
  .requires('item:update')
  .input(itemSchema.safeExtend({ id: cuid }))
  .handler(async (ctx, input) => {
    const item = await itemService.update(ctx, input)
    revalidatePath('/items')
    return { id: item.id }
  })

export const previewItemImport = action
  .requires('item:create')
  .input(csvImportSchema)
  .handler((ctx, input) => importItems(ctx, input, { dryRun: true }))

export const runItemImport = action
  .requires('item:create')
  .input(csvImportSchema)
  .handler(async (ctx, input) => {
    const result = await importItems(ctx, input)
    revalidatePath('/items')
    revalidatePath('/inventory')
    return result
  })

export const setReorderLimit = action
  .requires('item:update')
  .input(z.object({ id: cuid, reorderPoint: z.string().trim().max(40) }))
  .handler(async (ctx, input) => {
    const result = await itemService.setReorderPoint(ctx, input.id, input.reorderPoint)
    revalidatePath('/inventory/stock')
    revalidatePath('/inventory')
    revalidatePath('/items')
    return result
  })

export const setItemsActive = action
  .requires('item:archive')
  .input(bulkSetActiveSchema)
  .handler(async (ctx, input) => {
    const result = await itemService.setActive(ctx, input.ids, input.isActive)
    revalidatePath('/items')
    return result
  })

export const createCategory = action
  .requires('item:update')
  .input(z.object({ name: z.string().trim().min(1).max(120) }))
  .handler(async (ctx, input) => {
    const category = await itemService.createCategory(ctx, input.name)
    revalidatePath('/items')
    revalidatePath('/items/categories')
    return { id: category.id, name: category.name }
  })

export const updateCategory = action
  .requires('item:update')
  .input(z.object({ id: cuid, name: z.string().trim().min(1).max(120) }))
  .handler(async (ctx, input) => {
    const category = await itemService.updateCategory(ctx, input.id, input.name)
    revalidatePath('/items')
    revalidatePath('/items/categories')
    revalidatePath(`/items/categories/${category.id}`)
    return { id: category.id, name: category.name }
  })

export const deleteCategory = action
  .requires('item:update')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    const category = await itemService.deleteCategory(ctx, input.id)
    revalidatePath('/items')
    revalidatePath('/items/categories')
    revalidatePath(`/items/categories/${category.id}`)
    return { id: category.id, name: category.name }
  })

/** Add the standard merchandise categories (Building materials, Plumbing, …) that are missing. */
export const addStandardCategories = action
  .requires('item:update')
  .input(z.object({}))
  .handler(async (ctx) => {
    const before = await itemService.missingStandardCategories(ctx)
    await itemService.ensureStandardCategories(ctx)
    revalidatePath('/items')
    revalidatePath('/items/categories')
    return { added: before.length }
  })

/**
 * Hard-delete an unused item. Items with document or stock history must be
 * merged into another item instead.
 */
export const deleteItem = action
  .requires('item:delete')
  .input(deleteRecordSchema)
  .handler(async (ctx, input) => {
    assertItemDeleteAllowed(ctx)
    const result = await lifecycle.purgeItem(ctx, input.id)
    revalidatePath('/items')
    revalidatePath('/inventory/stock')
    revalidatePath('/reports')
    return { id: result.id, number: result.name }
  })

export const mergeItems = action
  .requires('item:delete')
  .input(z.object({ keepId: cuid, absorbId: cuid }))
  .handler(async (ctx, input) => {
    assertItemDeleteAllowed(ctx)
    const result = await lifecycle.mergeItems(ctx, input)
    revalidatePath('/items')
    revalidatePath('/inventory')
    revalidatePath('/inventory/stock')
    return result
  })

/** Fold one product category into another — items move; absorbed name is retired. */
export const mergeCategories = action
  .requires('item:update')
  .input(z.object({ keepId: cuid, absorbId: cuid }))
  .handler(async (ctx, input) => {
    const result = await lifecycle.mergeCategories(ctx, input)
    revalidatePath('/items')
    revalidatePath('/items/categories')
    revalidatePath(`/items/categories/${result.keepId}`)
    revalidatePath(`/items/categories/${input.absorbId}`)
    return result
  })

export async function createItemForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await createItem(formValues(formData)), 'Item created.')
}

export async function updateItemForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateItem(formValues(formData)), 'Item saved.')
}
