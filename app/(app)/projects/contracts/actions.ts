'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as construction from '@/server/services/construction.service'

const PATH = '/projects/contracts'

export async function billMilestoneAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await construction.billMilestone(ctx, {
    contractId: String(formData.get('contractId') ?? ''),
    milestoneId: String(formData.get('milestoneId') ?? ''),
    itemId: String(formData.get('itemId') ?? ''),
    description: String(formData.get('description') ?? '') || undefined,
  })
  revalidatePath(PATH)
  revalidatePath('/projects/progress')
}

export async function activateContractAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await construction.activateContract(ctx, String(formData.get('contractId') ?? ''))
  revalidatePath(PATH)
}

export async function updateContractAmountsAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  await construction.updateContractAmounts(ctx, {
    contractId: String(formData.get('contractId') ?? ''),
    changeOrderAmount: String(formData.get('changeOrderAmount') ?? '') || '0',
    retentionPercent: String(formData.get('retentionPercent') ?? '') || null,
  })
  revalidatePath(PATH)
}

export async function releaseVendorRetentionAction(formData: FormData) {
  const ctx = await requireOrgContext('bill:create')
  await construction.releaseVendorRetention(ctx, String(formData.get('billId') ?? ''))
  revalidatePath(PATH)
  revalidatePath('/projects/progress')
}