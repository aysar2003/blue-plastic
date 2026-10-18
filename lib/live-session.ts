import 'server-only'

import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { afterSignInPath } from '@/lib/after-sign-in'
import { isNavigationError } from '@/lib/db-error'
import { getOrgContext } from '@/server/auth/context'

/**
 * Resume a live session into the app. If the JWT is stale (membership revoked
 * or version-bumped per ADR-0007), do nothing — the login form must render.
 *
 * Sending a stale session back to `/dashboard` loops forever with the app
 * shell (`ERR_TOO_MANY_REDIRECTS`): layout → login → dashboard → layout…
 */
export async function resumeOrClearSession(
  _loginPath: '/login/company' | '/login/staff' | '/login' | '/login/portal',
  opts?: { signedOut?: boolean },
): Promise<void> {
  if (opts?.signedOut) return

  const session = await auth()
  if (!session?.user?.id) return

  let ctx = null
  try {
    ctx = await getOrgContext()
  } catch (error) {
    if (isNavigationError(error)) throw error
    return
  }
  if (ctx) redirect(await afterSignInPath(session.user.id))
}
