'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { cuid } from '@/lib/validation/common'
import { action } from '@/server/action'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError, validation } from '@/server/errors'
import {
  removeLedgerFile,
  storeLedgerFile,
  type LedgerFileLink,
} from '@/server/files/ledger-files'

const targetSchema = z.object({
  kind: z.enum(['purchase', 'sale', 'journal']),
  id: cuid,
})

function permissionFor(kind: 'purchase' | 'sale' | 'journal') {
  if (kind === 'purchase') return 'bill:update' as const
  if (kind === 'sale') return 'invoice:update' as const
  return 'journal:post' as const
}

function revalidateTarget(kind: 'purchase' | 'sale' | 'journal', id: string) {
  if (kind === 'purchase') {
    revalidatePath('/purchases')
    revalidatePath(`/purchases/bills/${id}`)
    revalidatePath(`/purchases/expenses/${id}`)
    revalidatePath(`/purchases/vendor-credits/${id}`)
    revalidatePath(`/purchases/purchase-orders/${id}`)
  } else if (kind === 'sale') {
    revalidatePath('/sales')
    revalidatePath(`/sales/invoices/${id}`)
    revalidatePath(`/sales/estimates/${id}`)
    revalidatePath(`/sales/quotations/${id}`)
    revalidatePath(`/sales/sales-orders/${id}`)
    revalidatePath(`/sales/sales-receipts/${id}`)
    revalidatePath(`/sales/credit-memos/${id}`)
    revalidatePath(`/sales/refunds/${id}`)
  } else {
    revalidatePath('/journals')
    revalidatePath(`/journals/${id}`)
  }
}

function linkFor(kind: 'purchase' | 'sale' | 'journal', id: string): LedgerFileLink {
  if (kind === 'purchase') return { purchaseDocumentId: id }
  if (kind === 'sale') return { salesDocumentId: id }
  return { journalId: id }
}

/**
 * Attach one or more PDF/image files to a sales document, purchase document,
 * or journal. Permission matches who may edit that record.
 */
export async function attachDocumentFile(formData: FormData) {
  try {
    const kindRaw = String(formData.get('kind') ?? '')
    const idRaw = String(formData.get('id') ?? '')
    const parsed = targetSchema.safeParse({ kind: kindRaw, id: idRaw })
    if (!parsed.success) {
      return { ok: false as const, error: { code: 'VALIDATION', message: 'Choose a document.' } }
    }

    const ctx = await requireOrgContext(permissionFor(parsed.data.kind))
    const files = formData.getAll('file').filter((entry): entry is File => entry instanceof File && entry.size > 0)
    if (files.length === 0) throw validation('Choose a PDF or image to attach.')

    const link = linkFor(parsed.data.kind, parsed.data.id)
    let count = 0
    for (const file of files) {
      await storeLedgerFile(ctx, file, link)
      count += 1
    }
    revalidateTarget(parsed.data.kind, parsed.data.id)
    return { ok: true as const, data: { count } }
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false as const, error: { code: error.code, message: error.message } }
    }
    console.error('[attachDocumentFile]', error)
    return { ok: false as const, error: { code: 'INTERNAL', message: 'Could not attach that file.' } }
  }
}

export const removeDocumentFile = action
  .input(
    z.object({
      fileId: cuid,
      kind: z.enum(['purchase', 'sale', 'journal']),
      id: cuid,
    }),
  )
  .handler(async (ctx, input) => {
    const need = permissionFor(input.kind)
    if (!ctx.permissions.has(need)) {
      const { forbidden } = await import('@/server/errors')
      throw forbidden(`This action requires the "${need}" permission.`)
    }
    const row = await removeLedgerFile(ctx, input.fileId)
    revalidateTarget(input.kind, input.id)
    return row
  })
