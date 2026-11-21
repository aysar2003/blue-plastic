'use server'

import { auth } from '@/auth'
import {
  DESK_PIN_NOT_SET,
  DESK_PIN_REQUIRED,
  DESK_PIN_WRONG,
  isDeskPin,
  normalizeDeskPin,
} from '@/lib/desk-unlock'
import { assertSignInRateLimit, clearSignInRateLimit } from '@/lib/auth-rate-limit'
import { unlockIdleScreenSchema } from '@/lib/validation/user'
import { db } from '@/server/db'
import { AppError, isAppError } from '@/server/errors'
import { fakeVerify, verifyPassword } from '@/server/auth/password'

export type UnlockScreenResult = { ok: true } | { ok: false; error: string }

/**
 * Re-check the signed-in user's password or optional desk PIN to clear the idle lock.
 * Does not create a new session — the JWT is already valid.
 * Desk PIN is independent of POS register pinHash.
 */
export async function unlockIdleScreen(input: {
  method: 'password' | 'pin'
  secret: string
}): Promise<UnlockScreenResult> {
  const parsed = unlockIdleScreenSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Enter your password or PIN.' }
  }

  const { method } = parsed.data
  const secret =
    method === 'pin' ? normalizeDeskPin(parsed.data.secret) : parsed.data.secret.trim()

  if (!secret) {
    return { ok: false, error: method === 'pin' ? DESK_PIN_REQUIRED : 'Enter your password.' }
  }

  if (method === 'pin' && !isDeskPin(secret)) {
    return { ok: false, error: DESK_PIN_WRONG }
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
    select: { id: true, passwordHash: true, deskPinHash: true },
  })

  if (method === 'password') {
    if (!user?.passwordHash) {
      await fakeVerify()
      return { ok: false, error: 'Wrong password.' }
    }
    if (!(await verifyPassword(secret, user.passwordHash))) {
      return { ok: false, error: 'Wrong password.' }
    }
  } else {
    if (!user?.deskPinHash) {
      await fakeVerify()
      return { ok: false, error: DESK_PIN_NOT_SET }
    }
    if (!(await verifyPassword(secret, user.deskPinHash))) {
      return { ok: false, error: DESK_PIN_WRONG }
    }
  }

  await clearSignInRateLimit(rateKey)
  return { ok: true }
}
