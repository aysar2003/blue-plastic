import { NextResponse } from 'next/server'

import { clientIpFromHeaders } from '@/lib/rate-limit'
import { isAppError } from '@/server/errors'
import { assertRateLimitAsync } from '@/server/rate-limit'
import * as deviceService from '@/server/services/attendance-device.service'

export const runtime = 'nodejs'

type Body = {
  externalUserId?: string
  punchedAt?: string
  kind?: 'IN' | 'OUT' | 'UNKNOWN'
  externalId?: string
  raw?: unknown
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (match?.[1]) return match[1].trim()
  return request.headers.get('x-device-token')?.trim() || null
}

export async function POST(request: Request) {
  try {
    const ip = clientIpFromHeaders(request.headers)
    try {
      await assertRateLimitAsync(`attendance-punch:${ip}`, {
        max: 120,
        windowMs: 15 * 60 * 1000,
        message: 'Too many punch attempts from this network. Try again later.',
      })
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === 'RATE_LIMITED') {
        return NextResponse.json({ error: error.message }, { status: 429 })
      }
      throw error
    }

    const token = bearerToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Missing device token.' }, { status: 401 })
    }
    if (token.length < 16 || token.length > 200) {
      return NextResponse.json({ error: 'Invalid device token.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Body
    if (!body.externalUserId || !body.punchedAt) {
      return NextResponse.json(
        { error: 'externalUserId and punchedAt are required.' },
        { status: 400 },
      )
    }
    const result = await deviceService.ingestPunch({
      token,
      externalUserId: String(body.externalUserId),
      punchedAt: String(body.punchedAt),
      kind: body.kind,
      externalId: body.externalId ? String(body.externalId) : null,
      raw: body.raw,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[attendance/punches]', error)
    return NextResponse.json({ error: 'Ingest failed.' }, { status: 500 })
  }
}
