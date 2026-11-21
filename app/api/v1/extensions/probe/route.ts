import { NextResponse } from 'next/server'

import { probeTrustedExtension } from '@/lib/erp/extensions/probe'
import { db } from '@/server/db'
import { requireApiKeyContext } from '@/server/auth/api-key-context'
import { isAppError } from '@/server/errors'

export const runtime = 'nodejs'

/** Capability probe: trusted extension id + machine catalogue it may call. */
export async function GET(request: Request) {
  try {
    const ctx = await requireApiKeyContext(request)
    const url = new URL(request.url)
    const extensionId = url.searchParams.get('extensionId') ?? ''
    const org = await db.organization.findUnique({
      where: { id: ctx.orgId },
      select: { trustedExtensions: true },
    })
    const probe = probeTrustedExtension(extensionId, org?.trustedExtensions)
    return NextResponse.json(
      { ok: probe.trusted, probe },
      { status: probe.trusted ? 200 : 400 },
    )
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[api/v1/extensions/probe]', error)
    return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
  }
}
