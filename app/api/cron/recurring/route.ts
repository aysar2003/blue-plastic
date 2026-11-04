import { NextResponse } from 'next/server'

import { isAppError } from '@/server/errors'
import * as recurringService from '@/server/services/recurring.service'

export const runtime = 'nodejs'

/**
 * Timer for due recurring templates. Call with Authorization: Bearer $CRON_SECRET
 * (or x-cron-secret). Safe when nothing is due — returns counts only.
 */
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
    const result = await recurringService.createDueForAllOrganizations()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[cron/recurring]', error)
    return NextResponse.json({ error: 'Recurring cron failed.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
