import { NextResponse } from 'next/server'

import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import { payslipPdf } from '@/server/services/payroll-standard.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()
    const { id } = await params
    const file = await payslipPdf(ctx, id)
    return new NextResponse(Buffer.from(file.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${file.filename}"`,
      },
    })
  } catch (error) {
    const message = isAppError(error) ? error.message : 'Could not build the payslip.'
    const status = isAppError(error) ? error.status : 500
    return NextResponse.json({ message }, { status })
  }
}
