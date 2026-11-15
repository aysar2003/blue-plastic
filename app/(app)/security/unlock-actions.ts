'use server'

import { auth } from '@/auth'
import { assertSignInRateLimit, clearSignInRateLimit } from '@/lib/auth-rate-limit'
import { db } from '@/server/db'
import { AppError, isAppError } from '@/server/errors'
import { fakeVerify, verifyPassword } from '@/server/auth/password'

export type UnlockScreenResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Re-check the signed-in user's password to clear the idle lock screen.
 * Does not create a new session — the JWT is already valid.
 */
export async function unlockIdleScreen(password: string): Promise<UnlockScreenResult> {
  const trimmed = password.trim()
  if (!trimmed) {
    return { ok: false, error: 'Enter your password.' }
  }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { ok: false, error: 'Your session has ended. Sign in again.' }
  }

  const rateKey = `unlock:${userId}`
  try {
    await assertSignInRateLimit(rateKey)
  } catch (error) {
    if (isAppError(error) && error.code === 'RATE_LIMITED') {
      return { ok: false, error: error.message }
    }
    if (error instanceof AppError && error.code === 'RATE_LIMITED') {
      return { ok: false, error: error.message }
    }
    throw error
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  })

  if (!user?.passwordHash) {
    await fakeVerify()
    return { ok: false, error: 'Wrong password.' }
  }

  if (!(await verifyPassword(trimmed, user.passwordHash))) {
    return { ok: false, error: 'Wrong password.' }
  }

  await clearSignInRateLimit(rateKey)
  return { ok: true }
}
