import { NextResponse } from 'next/server'

import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { backupJson, companyBackup } from '@/server/services/backup.service'

export const dynamic = 'force-dynamic'

/** The company's books, as a file, taken when someone asks for one. */
export async function GET() {
  try {
    const ctx = await requireOrgContext('org:update')
    const backup = await companyBackup(ctx)
    const day = today(ctx.organization.timeZone)
    const slug = ctx.organization.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'company'

    return new NextResponse(backupJson(backup), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}-backup-${day}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not take the backup.' }, { status: 500 })
  }
}
