'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as equityService from '@/server/services/equity-register.service'
import * as shareholderService from '@/server/services/shareholder.service'

export async function saveShareholder(formData: FormData) {
  const ctx = await requireOrgContext('journal:post')
  const name = String(formData.get('name') ?? '').trim()
  const shares = String(formData.get('shares') ?? '0').trim() || '0'
  const ownershipPercent = String(formData.get('ownershipPercent') ?? '0').trim() || '0'
  await shareholderService.upsertShareholder(ctx, { name, shares, ownershipPercent })
  revalidatePath('/accounting/equity')
  redirect('/accounting/equity')
}

export async function postEquityEvent(formData: FormData) {
  const ctx = await requireOrgContext('journal:post')
  const kind = String(formData.get('kind') ?? 'CONTRIBUTION') as
    | 'CONTRIBUTION'
    | 'DRAW'
    | 'DIVIDEND'
  const amount = String(formData.get('amount') ?? '').trim()
  const bankAccountId = String(formData.get('bankAccountId') ?? '').trim()
  const shareholderRaw = String(formData.get('shareholderId') ?? '').trim()
  const memo = String(formData.get('memo') ?? '').trim() || null
  await equityService.postEquityEvent(ctx, {
    kind,
    amount,
    bankAccountId,
    shareholderId: shareholderRaw || null,
    memo,
  })
  revalidatePath('/accounting/equity')
  revalidatePath('/journals')
  redirect('/accounting/equity')
}
