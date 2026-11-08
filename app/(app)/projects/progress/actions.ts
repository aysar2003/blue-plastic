'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as construction from '@/server/services/construction.service'

export async function saveContractAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await construction.updateProjectContract(ctx, {
    projectId: String(formData.get('projectId') ?? ''),
    contractValue: String(formData.get('contractValue') ?? ''),
    retentionPercent: String(formData.get('retentionPercent') ?? ''),
    retainerAmount: String(formData.get('retainerAmount') ?? ''),
  })
  revalidatePath('/projects/progress')
  redirect('/projects/progress')
}

export async function billProgressAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await construction.billProgress(ctx, {
    projectId: String(formData.get('projectId') ?? ''),
    toPercent: String(formData.get('toPercent') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
  })
  revalidatePath('/projects/progress')
  redirect(`/sales/invoices/${result.invoiceId}`)
}

export async function releaseRetentionAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await construction.releaseRetention(ctx, String(formData.get('invoiceId') ?? ''))
  revalidatePath('/projects/progress')
  redirect('/projects/progress')
}
