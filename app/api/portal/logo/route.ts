import { NextResponse } from 'next/server'

import { isAppError } from '@/server/errors'
import { readPublicPortalLogo } from '@/server/files/org-logo-public'

export const dynamic = 'force-dynamic'

/** Public company logo for `/portal/login?company=…` (portal feature must be on). */
export async function GET(request: Request) {
  try {
    const company = new URL(request.url).searchParams.get('company')
    if (!company) {
      return NextResponse.json({ error: 'Company is required.' }, { status: 400 })
    }
    const { bytes, contentType, filename } = await readPublicPortalLogo(company)
    const safe = filename.replace(/[\r\n"]/g, '')
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safe}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not read the logo.' }, { status: 500 })
  }
}
