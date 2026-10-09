import 'server-only'

import { cookies } from 'next/headers'

import { env } from '@/lib/env'
import { openRegisterUnlock, sealRegisterUnlock } from '@/lib/pos-unlock-token'

const COOKIE = 'pos-cashier-unlock'

function options() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
  }
}

/** Remember that this browser entered the PIN for this register. Replaces any other till. */
export async function grantRegisterUnlock(orgId: string, registerId: string) {
  const store = await cookies()
  store.set(
    COOKIE,
    sealRegisterUnlock({ orgId, registerId, secret: env.AUTH_SECRET }),
    options(),
  )
}

/** Drop the unlock so the next Open / Continue Selling has to ask again. */
export async function clearRegisterUnlock() {
  const store = await cookies()
  store.delete(COOKIE)
}

export async function registerUnlockMatches(orgId: string, registerId: string) {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return false
  const opened = openRegisterUnlock(token, env.AUTH_SECRET)
  return opened?.orgId === orgId && opened.registerId === registerId
}
