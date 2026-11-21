import { NextResponse } from 'next/server'

import { ingestInboundSignWebhook } from '@/server/services/sign-webhook.service'
import { isAppError } from '@/server/errors'

export const runtime = 'nodejs'

/**
 * Inbound sign-provider webhook.
 * HMAC-SHA256 of the raw JSON body in `X-Som-Signature` (optional `sha256=` prefix).
 * Identify the org with `?orgId=`.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')?.trim()
    if (!orgId) {
      return NextResponse.json({ error: 'orgId query is required.' }, { status: 400 })
    }
    const rawBody = await request.text()
    const signatureHeader =
      request.headers.get('x-som-signature') ?? request.headers.get('X-Som-Signature')
    const result = await ingestInboundSignWebhook({
      orgId,
      rawBody,
      signatureHeader,
    })
    const status = result.ok
      ? 200
      : result.status === 'REJECTED' && result.error?.includes('HMAC')
        ? 401
        : result.status === 'REJECTED'
          ? 400
          : result.error?.includes('not found')
            ? 404
            : 422
    return NextResponse.json(
      {
        ok: result.ok,
        eventId: result.eventId,
        applied: result.applied,
        status: result.status,
        signRequestId: result.signRequestId,
        mapped: result.mapped,
        error: result.error,
      },
      { status },
    )
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[webhooks/sign]', error)
    return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
  }
}
