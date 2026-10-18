'use server'

import { signOut } from '@/auth'
import { recordEvent } from '@/server/audit'
import { getOrgContext } from '@/server/auth/context'

/**
 * Sign out after writing LOGOUT on the company trail, so User history can show
 * when each person left as well as when they signed in.
 */
export async function signOutWithHistory(callbackUrl = '/login/company') {
  const ctx = await getOrgContext()
  if (ctx) {
    await recordEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entity: 'User',
      entityId: ctx.userId,
      action: 'LOGOUT',
    })
  }
  await signOut({ redirectTo: callbackUrl })
}
