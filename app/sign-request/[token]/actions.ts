'use server'

import { redirect } from 'next/navigation'

import * as collab from '@/server/services/collab.service'

export async function signRequest(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim()
  const signerName = String(formData.get('signerName') ?? '').trim()
  const signatureData = String(formData.get('signatureData') ?? '').trim()
  await collab.signByToken({ token, signerName, signatureData })
  redirect(`/sign-request/${encodeURIComponent(token)}`)
}

export async function declineRequest(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim() || null
  await collab.declineByToken({ token, reason })
  redirect(`/sign-request/${encodeURIComponent(token)}`)
}
