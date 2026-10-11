import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { readOrgLogo } from '@/server/files/org-logo'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = await requireOrgContext()
    const { bytes, contentType, filename } = await readOrgLogo(ctx)
    const safe = filename.replace(/[\r\n"]/g, '')
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safe}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not read the logo.' }, { status: 500 })
  }
}
