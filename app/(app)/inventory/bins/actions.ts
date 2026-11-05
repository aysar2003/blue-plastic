'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as wms from '@/server/services/wms.service'

const PATH = '/inventory/bins'

export async function createBin(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.createBin(ctx, {
    storeId: String(formData.get('storeId') ?? ''),
    code: String(formData.get('code') ?? ''),
    name: String(formData.get('name') ?? ''),
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function createPick(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  const salesOrderId = String(formData.get('salesOrderId') ?? '').trim()
  await wms.createPick(ctx, {
    storeId: String(formData.get('storeId') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
    qty: String(formData.get('qty') ?? ''),
    binId: String(formData.get('binId') ?? '') || null,
    sourceType: salesOrderId ? 'SALES_ORDER' : null,
    sourceId: salesOrderId || null,
    lotNumber: String(formData.get('lotNumber') ?? '') || null,
    serialNumber: String(formData.get('serialNumber') ?? '') || null,
  })
  revalidatePath(PATH)
  revalidatePath('/inventory/stock')
  redirect(PATH)
}

export async function startPick(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.startPick(ctx, String(formData.get('id') ?? ''))
  revalidatePath(PATH)
  redirect(PATH)
}

export async function completePick(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.completePick(ctx, String(formData.get('id') ?? ''))
  revalidatePath(PATH)
  revalidatePath('/inventory/stock')
  redirect(PATH)
}

export async function cancelPick(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.cancelPick(ctx, String(formData.get('id') ?? ''))
  revalidatePath(PATH)
  redirect(PATH)
}
