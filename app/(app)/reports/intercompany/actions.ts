'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as icMatch from '@/server/services/intercompany-match.service'

const PATH = '/reports/intercompany'

export async function confirmIcMatchAction(formData: FormData) {
  const ctx = await requireOrgContext('journal:create')
  await icMatch.confirmMatch(ctx, {
    journalAId: String(formData.get('journalAId') ?? ''),
    journalBId: String(formData.get('journalBId') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  })
  revalidatePath(PATH)
  revalidatePath('/reports/group-close')
  redirect(PATH)
}

export async function unmatchIcAction(formData: FormData) {
  const ctx = await requireOrgContext('journal:create')
  await icMatch.unmatch(ctx, String(formData.get('matchId') ?? ''))
  revalidatePath(PATH)
  revalidatePath('/reports/group-close')
  redirect(PATH)
}
