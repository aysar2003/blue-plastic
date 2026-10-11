import { NextResponse } from 'next/server'

import { makeBundle } from '@/lib/backup-format'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { isAppError } from '@/server/errors'
import { assertCanOpenCompany } from '@/server/services/company.service'
import { backupJson, companyBackup } from '@/server/services/backup.service'

export const dynamic = 'force-dynamic'

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company'
}

/**
 * Download a company backup JSON.
 * - current company (default)
 * - `?orgId=` one company this person may open
 * - `?scope=all` every company (system owner)
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('org:update')
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope')
    const orgIdParam = url.searchParams.get('orgId')
    const day = today(ctx.organization.timeZone)

    if (scope === 'all') {
      if (!ctx.isSystemOwner) {
        return NextResponse.json(
          { error: 'Only the system owner can download every company.' },
          { status: 403 },
        )
      }
      const organizations = await db.organization.findMany({
        select: { id: true },
        orderBy: { name: 'asc' },
      })
      const databases = []
      for (const organization of organizations) {
        databases.push(await companyBackup({ ...ctx, orgId: organization.id }))
      }
      const bundle = makeBundle(databases)
      return new NextResponse(backupJson(bundle), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="databases-backup-${day}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const targetOrgId = orgIdParam?.trim() || ctx.orgId
    if (targetOrgId !== ctx.orgId) {
      await assertCanOpenCompany(ctx, targetOrgId)
    }

    const organization = await db.organization.findUnique({
      where: { id: targetOrgId },
      select: { id: true, name: true },
    })
    if (!organization) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
    }

    const backup = await companyBackup({ ...ctx, orgId: organization.id })
    return new NextResponse(backupJson(backup), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slugify(organization.name)}-backup-${day}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : ''
    if (/timeout exceeded when trying to connect|connection timed out|Can't reach database/i.test(message)) {
      return NextResponse.json(
        { error: 'The database is busy. Wait a moment and try the backup again.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Could not take the backup.' }, { status: 500 })
  }
}
