'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as wip from '@/server/services/services-wip.service'

export async function billWipAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await wip.billWipFromTime(ctx, {
    projectId: String(formData.get('projectId') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
  })
  revalidatePath('/projects/wip')
  redirect(`/sales/invoices/${result.invoiceId}`)
}

export async function billRetainerAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await wip.billRetainer(ctx, {
    projectId: String(formData.get('projectId') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
    amount: String(formData.get('amount') ?? ''),
  })
  revalidatePath('/projects/wip')
  redirect(`/sales/invoices/${result.invoiceId}`)
}
