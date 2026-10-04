import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as workspace from '@/server/services/workspace.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = await requireOrgContext()
    const [bookmarks, tasks, feed] = await Promise.all([
      workspace.listBookmarks(ctx),
      workspace.tasks(ctx),
      workspace.feed(ctx),
    ])
    return NextResponse.json({ bookmarks, tasks, feed })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not load the workspace.' }, { status: 500 })
  }
}
