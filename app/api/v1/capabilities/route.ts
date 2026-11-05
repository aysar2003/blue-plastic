import { NextResponse } from 'next/server'

import { ERP_CAPABILITIES } from '@/lib/erp/capabilities'
import { requireApiKeyContext } from '@/server/auth/api-key-context'
import { isAppError } from '@/server/errors'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    await requireApiKeyContext(request)
    return NextResponse.json({
      ok: true,
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
