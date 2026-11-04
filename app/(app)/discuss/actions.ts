'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

export async function createChannel(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const name = String(formData.get('name') ?? '').trim()
  const created = await collab.createChannel(ctx, { name })
  revalidatePath('/discuss')
  redirect(`/discuss?channel=${encodeURIComponent(created.id)}`)
}

export async function postMessage(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const channelId = String(formData.get('channelId') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const parentId = String(formData.get('parentId') ?? '').trim() || null
  await collab.postMessage(ctx, { channelId, body, parentId })
  revalidatePath('/discuss')
  redirect(`/discuss?channel=${encodeURIComponent(channelId)}`)
}

export async function pinMessage(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const channelId = String(formData.get('channelId') ?? '').trim()
  const messageId = String(formData.get('messageId') ?? '').trim()
  const pinned = String(formData.get('pinned') ?? '') === '1'
  await collab.pinMessage(ctx, messageId, pinned)
  revalidatePath('/discuss')
  redirect(`/discuss?channel=${encodeURIComponent(channelId)}`)
}
