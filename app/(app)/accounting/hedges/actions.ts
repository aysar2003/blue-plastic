'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as hedges from '@/server/services/fx-hedge.service'

const PATH = '/accounting/hedges'

export async function createHedge(formData: FormData) {
  const ctx = await requireOrgContext('journal:post')
  await hedges.createHedge(ctx, {
    kind: String(formData.get('kind') ?? ''),
    currencyCode: String(formData.get('currencyCode') ?? ''),
    contractRate: String(formData.get('contractRate') ?? ''),
    notional: String(formData.get('notional') ?? ''),
    maturityDate: String(formData.get('maturityDate') ?? ''),
    risk: String(formData.get('risk') ?? ''),
    hedgedItem: String(formData.get('hedgedItem') ?? ''),
    instrument: String(formData.get('instrument') ?? ''),
    counterpart: String(formData.get('counterpart') ?? ''),
    memo: String(formData.get('memo') ?? ''),
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function settleHedge(formData: FormData) {
  const ctx = await requireOrgContext('journal:post')
  await hedges.settleHedge(ctx, {
    id: String(formData.get('id') ?? ''),
    spotRate: String(formData.get('spotRate') ?? ''),
    accountId: String(formData.get('accountId') ?? ''),
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function cancelHedge(formData: FormData) {
  const ctx = await requireOrgContext('journal:post')
  await hedges.cancelHedge(ctx, String(formData.get('id') ?? ''))
  revalidatePath(PATH)
  redirect(PATH)
}
