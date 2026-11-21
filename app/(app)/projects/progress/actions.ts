'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as construction from '@/server/services/construction.service'
import * as projectService from '@/server/services/project.service'

export async function saveContractAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await construction.updateProjectContract(ctx, {
    projectId: String(formData.get('projectId') ?? ''),
    contractValue: String(formData.get('contractValue') ?? ''),
    retentionPercent: String(formData.get('retentionPercent') ?? ''),
    retainerAmount: String(formData.get('retainerAmount') ?? ''),
    budgetAmount: String(formData.get('budgetAmount') ?? ''),
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

export async function setSiteStoreAction(formData: FormData) {
  const ctx = await requireOrgContext('project:update')
  await projectService.setSiteStore(ctx, {
    projectId: String(formData.get('projectId') ?? ''),
    storeId: String(formData.get('storeId') || '') || null,
  })
  revalidatePath('/projects/progress')
  redirect('/projects/progress')
}

export async function saveSovLineAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await construction.upsertSovLine(ctx, {
    id: String(formData.get('id') || '') || undefined,
    projectId: String(formData.get('projectId') ?? ''),
    contractId: String(formData.get('contractId') || '') || null,
    name: String(formData.get('name') ?? ''),
    budgetAmount: String(formData.get('budgetAmount') ?? '0'),
    percentComplete: String(formData.get('percentComplete') || '') || null,
    thisBillAmount: String(formData.get('thisBillAmount') || '') || null,
    retainagePercent: String(formData.get('retainagePercent') || '') || null,
  })
  revalidatePath('/projects/progress')
  redirect('/projects/progress')
}

export async function billSovLineAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const result = await construction.billSovLine(ctx, {
    sovLineId: String(formData.get('sovLineId') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
  })
  revalidatePath('/projects/progress')
  redirect(`/sales/invoices/${result.invoiceId}`)
}
