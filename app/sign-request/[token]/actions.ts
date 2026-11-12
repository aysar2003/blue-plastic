'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { clientIpFromHeaders } from '@/lib/rate-limit'
import { AppError } from '@/server/errors'
import { assertRateLimitAsync } from '@/server/rate-limit'
import * as collab from '@/server/services/collab.service'

async function assertPublicSignRateLimit() {
  const h = await headers()
  const ip = clientIpFromHeaders(h)
  try {
    await assertRateLimitAsync(`sign-request:${ip}`, {
      max: 30,
      windowMs: 15 * 60 * 1000,
      message: 'Too many signing attempts. Wait a few minutes, then try again.',
    })
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === 'RATE_LIMITED') {
      throw new AppError('RATE_LIMITED', error.message)
    }
    throw error
  }
}

export async function signRequest(formData: FormData) {
  await assertPublicSignRateLimit()
  const token = String(formData.get('token') ?? '').trim()
  const signerName = String(formData.get('signerName') ?? '').trim()
  const signatureData = String(formData.get('signatureData') ?? '').trim()
  await collab.signByToken({ token, signerName, signatureData })
  redirect(`/sign-request/${encodeURIComponent(token)}`)
}

export async function declineRequest(formData: FormData) {
  await assertPublicSignRateLimit()
  const token = String(formData.get('token') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim() || null
  await collab.declineByToken({ token, reason })
  redirect(`/sign-request/${encodeURIComponent(token)}`)
}
