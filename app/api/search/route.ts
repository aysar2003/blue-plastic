import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { searchBooks } from '@/server/services/search.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext()
    const query = new URL(request.url).searchParams.get('q') ?? ''
    const hits = await searchBooks(ctx, query)
    return NextResponse.json({ hits })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 })
  }
}
