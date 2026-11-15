'use server'

import { revalidatePath } from 'next/cache'

import { requireOrgContext } from '@/server/auth/context'
import * as loan from '@/server/services/loan.service'

export async function createLoanAccount(formData: FormData) {
  const ctx = await requireOrgContext('journal:post')
  await loan.createAccount(ctx, {
    customerId: String(formData.get('customerId') ?? ''),
    principal: String(formData.get('principal') ?? '0'),
    annualRate: String(formData.get('annualRate') ?? '0'),
    termMonths: Number(formData.get('termMonths') ?? 12),
    startDate: String(formData.get('startDate') ?? ''),
  })
  revalidatePath('/banking/loans')
}

export async function postLoanDue() {
  const ctx = await requireOrgContext('journal:post')
  await loan.postDue(ctx)
  revalidatePath('/banking/loans')
  revalidatePath('/journals')
}