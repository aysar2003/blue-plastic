'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as routing from '@/server/services/routing.service'

export async function saveRoutingAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  const itemId = String(formData.get('itemId') ?? '')
  const steps: {
    name: string
    minutes: string
    notes?: string | null
    workCenterId?: string | null
  }[] = []
  for (let index = 0; index < 4; index += 1) {
    const name = String(formData.get(`name${index}`) ?? '').trim()
    if (!name) continue
    steps.push({
      name,
      minutes: String(formData.get(`minutes${index}`) ?? '0'),
      notes: String(formData.get(`notes${index}`) ?? ''),
      workCenterId: String(formData.get(`workCenterId${index}`) || '') || null,
    })
  }
  await routing.replaceRouting(ctx, { itemId, steps })
  revalidatePath('/inventory/routing')
  redirect(`/inventory/routing?itemId=${itemId}`)
}

export async function saveWorkCenterAction(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await routing.upsertWorkCenter(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
    storeId: String(formData.get('storeId') || '') || null,
    capacityMinutesPerWeek: String(formData.get('capacityMinutesPerWeek') ?? '2400'),
  })
  revalidatePath('/inventory/routing')
  redirect('/inventory/routing')
}
