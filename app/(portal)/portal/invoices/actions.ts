'use server'

import { revalidatePath } from 'next/cache'

import { requirePortalContext } from '@/server/auth/context'
import { isAppError, validation } from '@/server/errors'
import * as portalService from '@/server/services/portal.service'

export async function uploadInvoicePaymentProof(formData: FormData) {
  try {
    const ctx = await requirePortalContext()
    const invoiceId = String(formData.get('invoiceId') ?? '').trim()
    if (!invoiceId) throw validation('Choose an invoice.')
    const file = formData.get('file')
    if (!(file instanceof File) || file.size <= 0) {
      throw validation('Choose a PDF or image of your payment proof.')
    }
    await portalService.attachInvoicePaymentProof(ctx, invoiceId, file)
    revalidatePath(`/portal/invoices/${invoiceId}`)
    return { ok: true as const }
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false as const, error: error.message }
    }
    console.error('[uploadInvoicePaymentProof]', error)
    return { ok: false as const, error: 'Could not upload that file.' }
  }
}
