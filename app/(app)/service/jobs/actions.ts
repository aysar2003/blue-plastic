'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { serviceJobSchema } from '@/lib/validation/service-job'
import { requireOrgContext } from '@/server/auth/context'
import * as serviceJobService from '@/server/services/service-job.service'

const PATH = '/service/jobs'

function revalidateJobs() {
  revalidatePath(PATH)
}

export async function createServiceJob(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const parsed = serviceJobSchema.parse({
    number: String(formData.get('number') ?? ''),
    date: String(formData.get('date') ?? ''),
    customerId: String(formData.get('customerId') ?? ''),
    projectId: String(formData.get('projectId') ?? '') || '',
    assigneeId: String(formData.get('assigneeId') ?? '') || '',
    vanStoreId: String(formData.get('vanStoreId') ?? '') || '',
    siteLocation: String(formData.get('siteLocation') ?? '') || undefined,
    promisedWindowStart: String(formData.get('promisedWindowStart') ?? '') || '',
    promisedWindowEnd: String(formData.get('promisedWindowEnd') ?? '') || '',
    memo: String(formData.get('memo') ?? '') || undefined,
    lines: [
      {
        kind: String(formData.get('lineKind') ?? 'LABOR'),
        itemId: String(formData.get('itemId') ?? '') || '',
        description: String(formData.get('lineDescription') ?? '') || undefined,
        quantity: String(formData.get('quantity') ?? '1'),
        unitPrice: String(formData.get('unitPrice') ?? '0'),
        vanStoreId: String(formData.get('lineVanStoreId') ?? '') || '',
      },
    ],
  })
  const job = await serviceJobService.create(ctx, parsed)
  revalidateJobs()
  redirect(`${PATH}/${job.id}`)
}

export async function scheduleJobAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await serviceJobService.schedule(ctx, String(formData.get('id') ?? ''))
  revalidateJobs()
  redirect(PATH)
}

export async function completeJobAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await serviceJobService.complete(ctx, String(formData.get('id') ?? ''))
  revalidateJobs()
  redirect(`/sales/invoices/${result.invoiceId}`)
}

export async function cancelJobAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await serviceJobService.cancel(ctx, String(formData.get('id') ?? ''))
  revalidateJobs()
  redirect(PATH)
}

export async function replenishVanAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const id = String(formData.get('id') ?? '')
  await serviceJobService.replenishVan(ctx, id)
  revalidateJobs()
  revalidatePath('/inventory/stock')
  redirect(`${PATH}/${id}`)
}