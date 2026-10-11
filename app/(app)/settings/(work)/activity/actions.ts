'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { cuid } from '@/lib/validation/common'
import { action, fail, ok, type ActionResult } from '@/server/action'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { removeTrashFile, storeTrashFiles } from '@/server/files/trash-files'

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
