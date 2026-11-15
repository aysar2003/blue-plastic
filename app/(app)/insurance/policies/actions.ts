'use server'

import { revalidatePath } from 'next/cache'

import { requireOrgContext } from '@/server/auth/context'
import * as insurance from '@/server/services/insurance.service'

const PATH = '/insurance/policies'

export async function createPolicy(formData: FormData) {
  const ctx = await requireOrgContext('customer:create')
  const recurring = String(formData.get('recurringTemplateId') ?? '').trim()
  await insurance.createPolicy(ctx, {
    customerId: String(formData.get('customerId') ?? ''),
    policyNumber: String(formData.get('policyNumber') ?? ''),
    premium: String(formData.get('premium') ?? '0'),
    startDate: String(formData.get('startDate') ?? ''),
    endDate: String(formData.get('endDate') ?? ''),
    recurringTemplateId: recurring || null,
  })
  revalidatePath(PATH)
}

export async function createPremiumRecurringAction(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const policyId = String(formData.get('policyId') ?? '')
  await insurance.createPremiumRecurring(ctx, policyId)
  revalidatePath(PATH)
}