import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { loadAnalyticsDashboard } from '@/server/services/analytics-dashboard.service'

export const dynamic = 'force-dynamic'

/** Structured analytics brief for AI agents and integrations. */
export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('report:overview')
    const url = new URL(request.url)
    const board = await loadAnalyticsDashboard(ctx, {
      period: url.searchParams.get('period'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      month: url.searchParams.get('month'),
    })
    return NextResponse.json(
      { brief: board.brief, selection: board.selection },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
