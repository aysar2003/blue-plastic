import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { importMissingCompanies } from '@/server/services/backup-import.service'

export const dynamic = 'force-dynamic'

/** Import missing companies from backup files into this instance. */
export async function POST(request: Request) {
  try {
    const ctx = await requireOrgContext('org:update')
    const form = await request.formData()
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File)
    const keysRaw = form.get('keys')
    const keys =
      typeof keysRaw === 'string'
        ? (JSON.parse(keysRaw) as string[])
        : Array.isArray(keysRaw)
          ? []
          : []

    if (files.length === 0) {
      return NextResponse.json({ error: 'Choose at least one backup file.' }, { status: 400 })
    }
    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ error: 'Choose at least one database to import.' }, { status: 400 })
    }

    const texts = await Promise.all(
      files.map(async (file) => ({ name: file.name || 'backup.json', text: await file.text() })),
    )
    const result = await importMissingCompanies(ctx, texts, keys)
    return NextResponse.json(result)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not import the backup.' }, { status: 500 })
  }
}
