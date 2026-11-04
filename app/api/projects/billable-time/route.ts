import { NextResponse } from 'next/server'

import { isAppError } from '@/server/errors'
import { requireOrgContext } from '@/server/auth/context'
import * as timeService from '@/server/services/project-time.service'

export const runtime = 'nodejs'

/** Unbilled billable project hours for a customer — invoice form pull. */
export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('invoice:create')
    const customerId = new URL(request.url).searchParams.get('customerId')
    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required.' }, { status: 400 })
    }
    const rows = await timeService.listBillableForCustomer(ctx, customerId)
    return NextResponse.json({ rows })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[billable-time]', error)
    return NextResponse.json({ error: 'Could not load billable time.' }, { status: 500 })
  }
}
