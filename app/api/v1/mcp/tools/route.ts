import { NextResponse } from 'next/server'

import { mcpToolDescriptors } from '@/lib/erp/mcp-tools'
import { requireApiKeyContext } from '@/server/auth/api-key-context'
import { isAppError } from '@/server/errors'

export const runtime = 'nodejs'

/** MCP tool list — same ids as ERP_CAPABILITIES. */
export async function GET(request: Request) {
  try {
    await requireApiKeyContext(request)
    return NextResponse.json({ ok: true, tools: mcpToolDescriptors() })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[api/v1/mcp/tools]', error)
    return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
  }
}
