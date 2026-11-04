'use server'

import type { CrmActivityKind, CrmOpportunityStage } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as crm from '@/server/services/crm.service'

export async function createOpportunity(formData: FormData) {
  const ctx = await requireOrgContext('customer:update')
  await crm.createOpportunity(ctx, {
    customerId: String(formData.get('customerId') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim(),
    amount: String(formData.get('amount') ?? '').trim() || null,
    expectedClose: String(formData.get('expectedClose') ?? '').trim() || null,
  })
  revalidatePath('/customers/pipeline')
  redirect('/customers/pipeline')
}

export async function moveOpportunity(formData: FormData) {
  const ctx = await requireOrgContext('customer:update')
  await crm.moveOpportunity(ctx, {
    id: String(formData.get('id') ?? '').trim(),
    stage: String(formData.get('stage') ?? '') as CrmOpportunityStage,
  })
  revalidatePath('/customers/pipeline')
  redirect('/customers/pipeline')
}

export async function logActivity(formData: FormData) {
  const ctx = await requireOrgContext('customer:update')
  await crm.logActivity(ctx, {
    customerId: String(formData.get('customerId') ?? '').trim(),
    kind: String(formData.get('kind') ?? 'NOTE') as CrmActivityKind,
    subject: String(formData.get('subject') ?? '').trim(),
    dueAt: String(formData.get('dueAt') ?? '').trim() || null,
  })
  revalidatePath('/customers/pipeline')
  redirect('/customers/pipeline')
}

export async function completeActivity(formData: FormData) {
  const ctx = await requireOrgContext('customer:update')
  await crm.completeActivity(ctx, String(formData.get('id') ?? '').trim())
  revalidatePath('/customers/pipeline')
  redirect('/customers/pipeline')
}
