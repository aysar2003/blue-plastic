'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as hotel from '@/server/services/hotel.service'

const PATH = '/hospitality'

export async function saveRoomType(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await hotel.upsertRoomType(ctx, {
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') ?? ''),
    baseRateItemId: String(formData.get('baseRateItemId') || '') || null,
    capacity: Number(formData.get('capacity') ?? 2),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/rooms`)
}

export async function saveRoom(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await hotel.upsertRoom(ctx, {
    id: String(formData.get('id') || '') || undefined,
    roomTypeId: String(formData.get('roomTypeId') ?? ''),
    code: String(formData.get('code') ?? ''),
    floor: String(formData.get('floor') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/rooms`)
}

export async function setHousekeeping(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await hotel.setHousekeeping(
    ctx,
    String(formData.get('roomId') ?? ''),
    String(formData.get('status') ?? 'CLEAN') as 'VACANT' | 'DIRTY' | 'CLEAN' | 'OOO',
  )
  revalidatePath(PATH)
  redirect(`${PATH}/rooms`)
}

export async function checkInGuest(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await hotel.checkIn(ctx, {
    roomId: String(formData.get('roomId') ?? ''),
    customerId: String(formData.get('customerId') ?? ''),
    adults: Number(formData.get('adults') ?? 1),
    notes: String(formData.get('notes') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/stays`)
}

export async function addCharge(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await hotel.addFolioCharge(ctx, {
    folioId: String(formData.get('folioId') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
    description: String(formData.get('description') ?? ''),
    quantity: String(formData.get('quantity') ?? '1'),
    unitPrice: String(formData.get('unitPrice') ?? '0'),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/stays`)
}

export async function checkOutGuest(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await hotel.checkOut(ctx, String(formData.get('stayId') ?? ''))
  revalidatePath(PATH)
  redirect(`/sales/invoices/${result.invoiceId}`)
}
