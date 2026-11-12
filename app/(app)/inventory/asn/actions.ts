'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as asn from '@/server/services/asn.service'

export async function createAsnAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  try {
    await asn.createAsn(ctx, {
      number: String(formData.get('number') ?? ''),
      vendorId: String(formData.get('vendorId') ?? ''),
      purchaseDocumentId: String(formData.get('purchaseDocumentId') || '') || null,
      expectedAt: String(formData.get('expectedAt') || '') || null,
      dockName: String(formData.get('dockName') || '') || null,
      dockAt: String(formData.get('dockAt') || '') || null,
      lines: [
        {
          itemId: String(formData.get('itemId') || '') || null,
          description: String(formData.get('description') || 'ASN line'),
          quantity: String(formData.get('quantity') ?? '1'),
        },
      ],
    })
  } catch (error) {
    const message = isAppError(error)
      ? error.message
      : 'Could not create the ASN. Check vendor and quantities.'
    redirect(`/inventory/asn?error=${encodeURIComponent(message)}`)
  }
  revalidatePath('/inventory/asn')
  redirect('/inventory/asn')
}

export async function receiveAsnAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  try {
    await asn.receiveAsn(ctx, String(formData.get('asnId') ?? ''))
  } catch (error) {
    const message = isAppError(error)
      ? error.message
      : 'Could not receive this ASN into stock. Link a PO with matching open qty, then try again.'
    redirect(`/inventory/asn?error=${encodeURIComponent(message)}`)
  }
  revalidatePath('/inventory/asn')
  redirect('/inventory/asn')
}
