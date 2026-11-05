import { NextResponse } from 'next/server'

import { isAppError } from '@/server/errors'
import * as reportPackService from '@/server/services/report-pack.service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  }

  const header = request.headers.get('authorization') ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim()
  const alt = request.headers.get('x-cron-secret')?.trim()
  if (bearer !== secret && alt !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const result = await reportPackService.runDueForAllOrganizations()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[cron/report-packs]', error)
    return NextResponse.json({ error: 'Report pack cron failed.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
