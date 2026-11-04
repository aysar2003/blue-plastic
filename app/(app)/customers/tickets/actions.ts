'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as crm from '@/server/services/crm.service'

export async function createTicket(formData: FormData) {
  const ctx = await requireOrgContext('customer:update')
  await crm.logActivity(ctx, {
    customerId: String(formData.get('customerId') ?? '').trim(),
    kind: 'TASK',
    subject: String(formData.get('subject') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim() || null,
    dueAt: String(formData.get('dueAt') ?? '').trim() || null,
  })
  revalidatePath('/customers/tickets')
  redirect('/customers/tickets')
}

export async function completeTicket(formData: FormData) {
  const ctx = await requireOrgContext('customer:update')
  await crm.completeActivity(ctx, String(formData.get('id') ?? '').trim())
  revalidatePath('/customers/tickets')
  redirect('/customers/tickets')
}
