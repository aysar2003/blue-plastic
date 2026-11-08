'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as ngo from '@/server/services/ngo.service'

const PATH = '/ngo'

export async function createPledgeAction(formData: FormData) {
  const ctx = await requireOrgContext('payment:create')
  await ngo.createPledge(ctx, {
    customerId: String(formData.get('customerId') ?? ''),
    amount: String(formData.get('amount') ?? ''),
    pledgedAt: String(formData.get('pledgedAt') || '') || undefined,
    dueDate: String(formData.get('dueDate') || '') || null,
    trackingCategoryId: String(formData.get('trackingCategoryId') || '') || null,
    purpose: String(formData.get('purpose') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`${PATH}/pledges`)
}

export async function receivePledgeAction(formData: FormData) {
  const ctx = await requireOrgContext('payment:create')
  const result = await ngo.receivePledge(ctx, {
    pledgeId: String(formData.get('pledgeId') ?? ''),
    depositAccountId: String(formData.get('depositAccountId') ?? ''),
    reference: String(formData.get('reference') ?? ''),
  })
  revalidatePath(PATH)
  redirect(`/payments/${result.paymentId}`)
}
