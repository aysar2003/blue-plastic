import { NextResponse } from 'next/server'

import type { ClosureKind } from '@/lib/period-closures'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as periodService from '@/server/services/period.service'

/**
 * Closed and locked accounting spans (months, completed quarters, years)
 * for report period pickers and the periods board.
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('period:read')
    const url = new URL(request.url)
    const kindParam = url.searchParams.get('kind')
    const kind: ClosureKind | undefined =
      kindParam === 'month' || kindParam === 'quarter' || kindParam === 'year'
        ? kindParam
        : undefined
    const filter = kind ? { kind } : undefined

    const [closures, latest] = await Promise.all([
      periodService.listClosures(ctx, filter),
      periodService.latestClosure(ctx),
    ])

    return NextResponse.json({ closures, latest })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error('[api/periods/closures]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}
