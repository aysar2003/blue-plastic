import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { readLedgerFile } from '@/server/files/ledger-files'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgContext()
    const { id } = await params
    const { file, bytes } = await readLedgerFile(ctx, id)
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
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not read the file.' }, { status: 500 })
  }
}
