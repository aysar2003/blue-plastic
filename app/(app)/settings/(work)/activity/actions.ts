'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { cuid } from '@/lib/validation/common'
import { action, fail, ok, type ActionResult } from '@/server/action'
import type { OrgContext } from '@/server/auth/context'
import { requireOrgContext } from '@/server/auth/context'
import type { Permission } from '@/server/auth/permissions'
import { forbidden, isAppError } from '@/server/errors'
import { removeTrashFile, storeTrashFiles } from '@/server/files/trash-files'
import * as trashService from '@/server/services/trash.service'

function isUpload(value: FormDataEntryValue): value is File {
  return value instanceof File && value.size > 0 && value.name !== ''
}

export async function attachTrashFile(
  formData: FormData,
): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireOrgContext('audit:read')
    const auditLogId = formData.get('auditLogId')
    if (typeof auditLogId !== 'string' || !auditLogId) {
      return fail('VALIDATION', 'Missing trash entry.')
    }
    const files = formData.getAll('file').filter(isUpload)
    const stored = await storeTrashFiles(ctx, auditLogId, files)
    revalidatePath(`/settings/activity/${auditLogId}`)
    revalidatePath('/settings/activity')
    return ok({ count: stored.length })
  } catch (error) {
    if (isAppError(error)) return fail(error.code, error.message, error.details)
    console.error('[attachTrashFile]', error)
    return fail('INTERNAL', 'Could not attach that file.')
  }
}

export const deleteTrashFile = action
  .requires('audit:read')
  .input(z.object({ auditLogId: cuid, fileId: cuid }))
  .handler(async (ctx, input) => {
    await removeTrashFile(ctx, input.auditLogId, input.fileId)
    revalidatePath(`/settings/activity/${input.auditLogId}`)
    revalidatePath('/settings/activity')
    return { id: input.fileId }
  })

/**
 * Put a deleted transaction back into the books from Trash.
 *
 * Uses the same permissions as deleting the matching kind, so somebody who can
 * withdraw a record can also undo a mis-click.
 */
export const restoreTrashEntry = action
  .requires('audit:read')
  .input(z.object({ id: cuid }))
  .handler(async (ctx, input) => {
    const entry = await trashService.get(ctx, input.id)
    assertRestorePermission(ctx, entry.entity)
    const result = await trashService.restore(ctx, input.id)
    revalidatePath('/settings/activity')
    revalidatePath(`/settings/activity/${input.id}`)
    revalidatePath('/journals')
    revalidatePath('/sales')
    revalidatePath('/purchases')
    revalidatePath('/banking')
    revalidatePath('/inventory')
    if (result.href) revalidatePath(result.href)
    return result
  })

/** Empty the whole Trash list. Owner/admin only — restore is no longer offered. */
export const clearAllTrash = action
  .requires('org:update')
  .input(z.object({}))
  .handler(async (ctx) => {
    const result = await trashService.clearAll(ctx)
    revalidatePath('/settings/activity')
    return result
  })

/** Remove one Trash line permanently from the list. */
export const clearTrashEntry = action
  .requires('org:update')
  .input(z.object({ id: cuid }))
  .handler(async (ctx, input) => {
    const result = await trashService.clearOne(ctx, input.id)
    revalidatePath('/settings/activity')
    revalidatePath(`/settings/activity/${input.id}`)
    return result
  })

function assertRestorePermission(ctx: OrgContext, entity: string) {
  const need: Permission | null =
    entity === 'Journal'
      ? 'journal:reverse'
      : entity === 'SalesDocument'
        ? 'invoice:void'
        : entity === 'CustomerPayment'
          ? 'payment:void'
          : entity === 'PurchaseDocument'
            ? 'bill:void'
            : entity === 'BillPayment'
              ? 'expense:void'
              : entity === 'BankTransfer' || entity === 'Deposit'
                ? 'bank:transact'
                : entity === 'InventoryAdjustment' || entity === 'AssemblyBuild'
                  ? 'inventory:adjust'
                  : null

  if (need && ctx.permissions.has(need)) return
  if (ctx.permissions.has('invoice:void') || ctx.permissions.has('journal:reverse')) return

  throw forbidden('You do not have permission to restore this record.')
}
