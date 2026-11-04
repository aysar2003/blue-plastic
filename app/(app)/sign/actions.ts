'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

export async function createSignRequest(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const title = String(formData.get('title') ?? '').trim()
  const signerName = String(formData.get('signerName') ?? '').trim() || null
  const signerEmail = String(formData.get('signerEmail') ?? '').trim() || null
  const message = String(formData.get('message') ?? '').trim() || null
  await collab.createSignRequest(ctx, { title, signerName, signerEmail, message })
  revalidatePath('/sign')
  redirect('/sign')
}

export async function markSigned(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const id = String(formData.get('id') ?? '').trim()
  const signerName = String(formData.get('signerName') ?? '').trim()
  const signatureData = String(formData.get('signatureData') ?? '').trim() || signerName
  await collab.markSigned(ctx, {
    id,
    signerName,
    signatureData,
  })
  revalidatePath('/sign')
  redirect('/sign')
}

export async function emailSignRequest(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const id = String(formData.get('id') ?? '').trim()
  await collab.emailSignRequest(ctx, id)
  revalidatePath('/sign')
  redirect('/sign')
}

export async function cancelSignRequest(formData: FormData) {
  const ctx = await requireOrgContext('knowledge:create')
  const id = String(formData.get('id') ?? '').trim()
  await collab.cancelSignRequest(ctx, id)
  revalidatePath('/sign')
  redirect('/sign')
}
