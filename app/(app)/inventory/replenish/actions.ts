'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as inventory from '@/server/services/inventory.service'

export async function draftReplenishAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  const toStoreId = String(formData.get('toStoreId') ?? '')
  const lines: { itemId: string; quantity: string }[] = []

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('line_') || value !== 'on') continue
    const itemId = key.slice('line_'.length)
    const qty = String(formData.get(`qty_${itemId}`) ?? '0')
    lines.push({ itemId, quantity: qty })
  }

  await inventory.createDraftReplenishmentTransfers(ctx, { toStoreId, lines })
  revalidatePath('/inventory/replenish')
  redirect('/inventory/replenish?storeId=' + encodeURIComponent(toStoreId))
}

export async function postDraftReplenishAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  const toStoreId = String(formData.get('toStoreId') ?? '')
  await inventory.postDraftReplenishmentTransfers(ctx, { toStoreId })
  revalidatePath('/inventory/replenish')
  revalidatePath('/inventory/stock')
  redirect('/inventory/replenish?storeId=' + encodeURIComponent(toStoreId) + '&posted=1')
}