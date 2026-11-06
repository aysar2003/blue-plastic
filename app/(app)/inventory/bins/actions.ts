'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as wms from '@/server/services/wms.service'

const PATH = '/inventory/bins'

function refresh() {
  revalidatePath(PATH)
  revalidatePath('/inventory/stock')
}

export async function createBin(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.createBin(ctx, {
    storeId: String(formData.get('storeId') ?? ''),
    code: String(formData.get('code') ?? ''),
    name: String(formData.get('name') ?? ''),
  })
  refresh()
  redirect(PATH)
}

export async function createPick(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  const salesOrderId = String(formData.get('salesOrderId') ?? '').trim()
  const waveId = String(formData.get('waveId') ?? '').trim()
  await wms.createPick(ctx, {
    storeId: String(formData.get('storeId') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
    qty: String(formData.get('qty') ?? ''),
    binId: String(formData.get('binId') ?? '') || null,
    sourceType: salesOrderId ? 'SALES_ORDER' : null,
    sourceId: salesOrderId || null,
    lotNumber: String(formData.get('lotNumber') ?? '') || null,
    serialNumber: String(formData.get('serialNumber') ?? '') || null,
    waveId: waveId || null,
  })
  refresh()
  redirect(PATH)
}

export async function createPutaway(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.createPutaway(ctx, {
    storeId: String(formData.get('storeId') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
    qty: String(formData.get('qty') ?? ''),
    binId: String(formData.get('binId') ?? '') || null,
  })
  refresh()
  redirect(PATH)
}

export async function completePutaway(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.completePutaway(
    ctx,
    String(formData.get('id') ?? ''),
    String(formData.get('binId') ?? '') || null,
  )
  refresh()
  redirect(PATH)
}

export async function cancelPutaway(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.cancelPutaway(ctx, String(formData.get('id') ?? ''))
  refresh()
  redirect(PATH)
}

export async function createWave(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.createWave(ctx, String(formData.get('notes') ?? '') || null)
  refresh()
  redirect(PATH)
}

export async function releaseWave(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.releaseWave(ctx, String(formData.get('id') ?? ''))
  refresh()
  redirect(PATH)
}

export async function completeWave(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.completeWave(ctx, String(formData.get('id') ?? ''))
  refresh()
  redirect(PATH)
}

export async function cancelWave(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.cancelWave(ctx, String(formData.get('id') ?? ''))
  refresh()
  redirect(PATH)
}

export async function startPick(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.startPick(ctx, String(formData.get('id') ?? ''))
  refresh()
  redirect(PATH)
}

export async function completePick(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.completePick(ctx, String(formData.get('id') ?? ''))
  refresh()
  redirect(PATH)
}

export async function cancelPick(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await wms.cancelPick(ctx, String(formData.get('id') ?? ''))
  refresh()
  redirect(PATH)
}
