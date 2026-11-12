'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as pricing from '@/server/services/pricing.service'

const PATH = '/settings/pricing'

export async function savePriceListAction(formData: FormData) {
  const ctx = await requireOrgContext('item:update')
  const itemId = String(formData.get('itemId') || '')
  const unitPrice = String(formData.get('unitPrice') || '')
  await pricing.upsertPriceList(ctx, {
    name: String(formData.get('name') ?? ''),
    lines:
      itemId && unitPrice
        ? [{ itemId, unitPrice }]
        : undefined,
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function assignCustomerListAction(formData: FormData) {
  const ctx = await requireOrgContext('customer:update')
  await pricing.assignCustomerPriceList(ctx, {
    customerId: String(formData.get('customerId') ?? ''),
    priceListId: String(formData.get('priceListId') || '') || null,
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function savePromotionAction(formData: FormData) {
  const ctx = await requireOrgContext('item:update')
  await pricing.upsertPromotion(ctx, {
    name: String(formData.get('name') ?? ''),
    itemId: String(formData.get('itemId') || '') || null,
    percentOff: String(formData.get('percentOff') ?? ''),
    startsOn: String(formData.get('startsOn') ?? ''),
    endsOn: String(formData.get('endsOn') ?? ''),
  })
  revalidatePath(PATH)
  redirect(PATH)
}
