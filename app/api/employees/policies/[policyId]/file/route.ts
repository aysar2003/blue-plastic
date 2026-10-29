import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { readPolicyFile } from '@/server/files/employee-hr-files'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  context: { params: Promise<{ policyId: string }> },
) {
  try {
    const ctx = await requireOrgContext('hr:read')
    const { policyId } = await context.params
    const { file, bytes } = await readPolicyFile(ctx, policyId)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': file.contentType ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${file.originalName ?? 'policy'}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
