'use server'

import { revalidatePath } from 'next/cache'

import { requireOrgContext } from '@/server/auth/context'
import * as franchise from '@/server/services/franchise.service'

export async function setFranchiseRoyalty(formData: FormData) {
  const ctx = await requireOrgContext('org:update')
  const childOrgId = String(formData.get('childOrgId') ?? '')
  const percent = String(formData.get('percent') ?? '').trim()
  await franchise.setChildRoyaltyPercent(ctx, childOrgId, percent || null)
  revalidatePath('/reports/franchise')
}

export async function catalogPushToChild(formData: FormData) {
  const ctx = await requireOrgContext('item:update')
  const childOrgId = String(formData.get('childOrgId') ?? '')
  await franchise.catalogPush(ctx, childOrgId)
  revalidatePath('/reports/franchise')
}

export async function accrueFranchiseRoyalty(formData: FormData) {
  const ctx = await requireOrgContext('journal:post')
  const childOrgId = String(formData.get('childOrgId') ?? '')
  const asOfMonth = String(formData.get('asOfMonth') ?? '').slice(0, 10)
  await franchise.accrueRoyalty(ctx, childOrgId, asOfMonth)
  revalidatePath('/reports/franchise')
  revalidatePath('/journals')
}