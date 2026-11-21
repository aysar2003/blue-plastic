'use server'

import { revalidatePath } from 'next/cache'

import { requireOrgContext } from '@/server/auth/context'
import * as dunning from '@/server/services/dunning.service'

export async function sendDunningReminder(formData: FormData) {
  const ctx = await requireOrgContext('invoice:create')
  const invoiceId = String(formData.get('invoiceId') ?? '').trim()
  await dunning.sendReminder(ctx, invoiceId)
  revalidatePath('/sales/subscriptions/dunning')
}
