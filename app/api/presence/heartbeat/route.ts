import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { isAppError } from '@/server/errors'
import * as presenceService from '@/server/services/presence.service'

export const dynamic = 'force-dynamic'

/** Signed-in desk tab → refresh User.lastSeenAt for online/offline lists. */
export async function POST() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }
    const result = await presenceService.touchPresence(userId)
    return NextResponse.json(result)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not update presence.' }, { status: 500 })
  }
}
