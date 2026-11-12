'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as itemLotService from '@/server/services/item-lot.service'

const PATH = '/inventory/expiry'

export async function disposeLotAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await itemLotService.disposeExpiredLot(ctx, {
    lotId: String(formData.get('lotId') ?? ''),
    quantity: String(formData.get('quantity') ?? '') || undefined,
  })
  revalidatePath(PATH)
  redirect(PATH)
}
