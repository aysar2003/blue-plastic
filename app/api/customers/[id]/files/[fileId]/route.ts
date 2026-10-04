import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { readCustomerFile } from '@/server/files/customer-files'

export const dynamic = 'force-dynamic'

/** The customer's photo or a debt-agreement paper. Only someone in the organisation can read it. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const ctx = await requireOrgContext('customer:read')
    const { id, fileId } = await params
    const { file, bytes } = await readCustomerFile(ctx, id, fileId)
    const filename = file.originalName.replace(/[\r\n"]/g, '')
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    }
    console.error('[api/customers/files]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}
