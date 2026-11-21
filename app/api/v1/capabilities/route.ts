import { NextResponse } from 'next/server'

import { ERP_CAPABILITIES } from '@/lib/erp/capabilities'
import { probeTrustedExtension } from '@/lib/erp/extensions/probe'
import { db } from '@/server/db'
import { requireApiKeyContext } from '@/server/auth/api-key-context'
import { isAppError } from '@/server/errors'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKeyContext(request)
    const url = new URL(request.url)
    const extensionId = url.searchParams.get('extensionId')
    const orgAllowlist = await db.organization.findUnique({
      where: { id: ctx.orgId },
      select: { trustedExtensions: true },
    })
    const probe = extensionId
      ? probeTrustedExtension(extensionId, orgAllowlist?.trustedExtensions)
      : null
    if (probe && !probe.trusted) {
      return NextResponse.json({ error: probe.error ?? 'Untrusted extension.', probe }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      probe: probe ?? undefined,
      capabilities: ERP_CAPABILITIES.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        layer: c.layer,
        loop: c.loop,
        permission: c.permission,
        method: c.method,
        path: c.path,
        service: c.service,
      })),
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[api/v1/capabilities]', error)
    return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
  }
}
