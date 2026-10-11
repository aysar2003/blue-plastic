import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { inspectBackupFiles } from '@/server/services/backup-import.service'

export const dynamic = 'force-dynamic'

/** Look inside one or more backup files — which companies are already here. */
export async function POST(request: Request) {
  try {
    const ctx = await requireOrgContext('org:update')
    if (!ctx.isSystemOwner) {
      return NextResponse.json(
        { error: 'Only the system owner can import a company.' },
        { status: 403 },
      )
    }
    const form = await request.formData()
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ error: 'Choose at least one backup file.' }, { status: 400 })
    }

    const texts = await Promise.all(
      files.map(async (file) => ({ name: file.name || 'backup.json', text: await file.text() })),
    )
    const companies = await inspectBackupFiles(texts)
    return NextResponse.json({ companies })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not read the backup.' }, { status: 500 })
  }
}
