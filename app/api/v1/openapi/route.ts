import { NextResponse } from 'next/server'

import { buildOpenApiDocument } from '@/lib/erp/openapi'

export const runtime = 'nodejs'

/** Public machine catalogue — no secrets; auth is documented, not required to read the spec. */
export async function GET() {
  return NextResponse.json(buildOpenApiDocument())
}
