'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { workOrderSchema } from '@/lib/validation/work-order'
import { requireOrgContext } from '@/server/auth/context'
import * as workOrderService from '@/server/services/work-order.service'

const PATH = '/inventory/work-orders'

function revalidateWorkOrders() {
  revalidatePath(PATH)
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/builds/new')
  revalidatePath('/items')
  revalidatePath('/journals')
}

export async function createWorkOrder(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  const parsed = workOrderSchema.parse({
    number: String(formData.get('number') ?? ''),
    date: String(formData.get('date') ?? ''),
    dueDate: String(formData.get('dueDate') ?? '') || '',
    itemId: String(formData.get('itemId') ?? ''),
    storeId: String(formData.get('storeId') ?? '') || '',
    quantity: String(formData.get('quantity') ?? ''),
    memo: String(formData.get('memo') ?? '') || undefined,
  })
  const wo = await workOrderService.create(ctx, parsed)
  revalidateWorkOrders()
  redirect(`${PATH}/${wo.id}`)
}

export async function releaseWorkOrder(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await workOrderService.release(ctx, String(formData.get('id') ?? ''))
  revalidateWorkOrders()
  redirect(PATH)
}

export async function completeWorkOrder(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await workOrderService.complete(ctx, String(formData.get('id') ?? ''))
  revalidateWorkOrders()
  redirect(PATH)
}

export async function cancelWorkOrder(formData: FormData) {
  const ctx = await requireOrgContext('inventory:adjust')
  await workOrderService.cancel(ctx, String(formData.get('id') ?? ''))
  revalidateWorkOrders()
  redirect(PATH)
}
