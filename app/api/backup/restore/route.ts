import { NextResponse } from 'next/server'

import { companiesFromParsed } from '@/lib/backup-format'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { replaceCompanyFromBackup } from '@/server/services/backup-restore.service'

export const dynamic = 'force-dynamic'

/**
 * Replace one existing company with a point-in-time backup of that company.
 * Everything entered after the backup is discarded.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireOrgContext('org:update')
    const form = await request.formData()
    const file = form.get('file')
    const targetOrgId = typeof form.get('targetOrgId') === 'string' ? String(form.get('targetOrgId')) : ''
    const confirmName = typeof form.get('confirmName') === 'string' ? String(form.get('confirmName')) : ''
    const key = typeof form.get('key') === 'string' ? String(form.get('key')) : ''

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a backup file.' }, { status: 400 })
    }
    if (!targetOrgId || !confirmName) {
      return NextResponse.json({ error: 'Confirm the company to restore.' }, { status: 400 })
    }

    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Could not read the backup as JSON.' }, { status: 400 })
    }

    const companies = companiesFromParsed(parsed, file.name || 'backup.json')
    if (companies.length === 0) {
      return NextResponse.json({ error: 'This file is not a SOM ERP backup.' }, { status: 400 })
    }

    const chosen =
      (key ? companies.find((row) => row.key === key) : null) ??
      companies.find((row) => row.organizationId === targetOrgId) ??
      companies[0]

    if (!chosen) {
      return NextResponse.json({ error: 'Could not find that company in the backup.' }, { status: 400 })
    }

    const result = await replaceCompanyFromBackup(ctx, {
      targetOrgId,
      confirmName,
      backup: chosen.payload,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('backup restore failed', error)
    return NextResponse.json({ error: 'Could not restore the backup.' }, { status: 500 })
  }
}
