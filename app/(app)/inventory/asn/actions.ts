'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as asn from '@/server/services/asn.service'

export async function createAsnAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await asn.createAsn(ctx, {
    number: String(formData.get('number') ?? ''),
    vendorId: String(formData.get('vendorId') ?? ''),
    purchaseDocumentId: String(formData.get('purchaseDocumentId') || '') || null,
    expectedAt: String(formData.get('expectedAt') || '') || null,
    lines: [
      {
        itemId: String(formData.get('itemId') || '') || null,
        description: String(formData.get('description') || 'ASN line'),
        quantity: String(formData.get('quantity') ?? '1'),
      },
    ],
  })
  revalidatePath('/inventory/asn')
  redirect('/inventory/asn')
}

export async function receiveAsnAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await asn.receiveAsn(ctx, String(formData.get('asnId') ?? ''))
  revalidatePath('/inventory/asn')
  redirect('/inventory/asn')
}
