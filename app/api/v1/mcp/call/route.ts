import { NextResponse } from 'next/server'
import { z } from 'zod'

import { invokeCapability, readJsonBody } from '@/server/api/v1/dispatch'

export const runtime = 'nodejs'

const callSchema = z.object({
  name: z.string().min(1),
  arguments: z.unknown().optional(),
})

/** MCP-style invoke: { name: capabilityId, arguments: {...} } */
export async function POST(request: Request) {
  const body = await readJsonBody(request)
  const parsed = callSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Expected { name, arguments? }.' },
      { status: 422 },
    )
  }
  return invokeCapability(request, parsed.data.name, parsed.data.arguments ?? {})
}
