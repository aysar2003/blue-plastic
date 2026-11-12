'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as nightAudit from '@/server/services/night-audit.service'

const PATH = '/pos/night-audit'

export async function closeNightAudit(formData: FormData) {
  const ctx = await requireOrgContext('pos:manage')
  await nightAudit.closeNight(
    ctx,
    String(formData.get('businessDate') ?? ''),
    String(formData.get('memo') ?? ''),
  )
  revalidatePath(PATH)
  redirect(PATH)
}

export async function payoutNightTips(formData: FormData) {
  const ctx = await requireOrgContext('pos:manage')
  await nightAudit.payoutTips(ctx, {
    nightAuditId: String(formData.get('nightAuditId') ?? ''),
    bankAccountId: String(formData.get('bankAccountId') ?? ''),
    amount: String(formData.get('amount') ?? '') || undefined,
  })
  revalidatePath(PATH)
  redirect(PATH)
}
