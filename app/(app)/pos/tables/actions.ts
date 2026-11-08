'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as dining from '@/server/services/dining-table.service'

const PATH = '/pos/tables'

export async function saveTable(formData: FormData) {
  const ctx = await requireOrgContext('pos:manage')
  await dining.upsertTable(ctx, {
    id: String(formData.get('id') || '') || undefined,
    code: String(formData.get('code') ?? ''),
    name: String(formData.get('name') ?? ''),
    seats: Number(formData.get('seats') ?? 4),
    zone: String(formData.get('zone') ?? ''),
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function seatTable(formData: FormData) {
  const ctx = await requireOrgContext('pos:sell')
  await dining.setTableStatus(ctx, String(formData.get('tableId') ?? ''), 'SEATED')
  revalidatePath(PATH)
  redirect(PATH)
}

export async function billTable(formData: FormData) {
  const ctx = await requireOrgContext('pos:sell')
  await dining.setTableStatus(ctx, String(formData.get('tableId') ?? ''), 'BILL')
  revalidatePath(PATH)
  redirect(PATH)
}

export async function clearTable(formData: FormData) {
  const ctx = await requireOrgContext('pos:sell')
  await dining.setTableStatus(ctx, String(formData.get('tableId') ?? ''), 'OPEN')
  revalidatePath(PATH)
  redirect(PATH)
}
