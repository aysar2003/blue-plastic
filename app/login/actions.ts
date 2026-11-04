'use server'

import { AuthError } from 'next-auth'
import { cookies } from 'next/headers'

import { signIn } from '@/auth'
import { env } from '@/lib/env'
import {
  LOGIN_TICKET_TTL_MS,
  PREAUTH_COOKIE,
  PREAUTH_TTL_MS,
  openPreAuth,
  sealLoginTicket,
  sealPreAuth,
} from '@/lib/login-ticket'
import { WRONG_DOOR } from '@/lib/login-paths'
import { signInSchema, twoFactorCodeSchema } from '@/lib/validation/auth'
import { beginLoginOtp, verifyLoginSecondFactor } from '@/server/services/auth-2fa.service'
import { verifyCredentials, type VerifiedAudience } from '@/server/auth/verify-credentials'

export type DoorSignInState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  /** Password OK — show the second-factor step. */
  needsTwoFactor?: boolean
  /** Hint for the UI: authenticator, email code, or either. */
  twoFactorHint?: 'totp' | 'otp' | 'either'
}

const REDIRECT: Record<Exclude<VerifiedAudience, null>, string> = {
  staff: '/databases',
  company: '/dashboard',
  portal: '/portal',
}

const GENERIC = 'That email or mobile and password do not match an active account.'

async function doorSignIn(
  expected: Exclude<VerifiedAudience, null>,
  formData: FormData,
): Promise<DoorSignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { fieldErrors }
  }

  const verified = await verifyCredentials(parsed.data.email, parsed.data.password)
  if (!verified) {
    return { error: GENERIC }
  }

  if (verified.audience !== expected) {
    return { error: WRONG_DOOR[expected] }
  }

  if (verified.needsTwoFactor) {
    try {
      const { challengeId } = await beginLoginOtp(verified.userId)
      const token = sealPreAuth(
        {
          userId: verified.userId,
          challengeId,
          audience: expected,
          email: verified.email,
          exp: Date.now() + PREAUTH_TTL_MS,
        },
        env.AUTH_SECRET,
      )
      const jar = await cookies()
      jar.set(PREAUTH_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: Math.floor(PREAUTH_TTL_MS / 1000),
      })

      const twoFactorHint =
        verified.totpEnabled && verified.otp2faEnabled
          ? 'either'
          : verified.totpEnabled
            ? 'totp'
            : 'otp'

      return { needsTwoFactor: true, twoFactorHint }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start two-factor sign-in.'
      return { error: message }
    }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: REDIRECT[expected],
    })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: GENERIC }
    }
    throw error
  }
}

export async function staffSignInAction(
  _prev: DoorSignInState,
  formData: FormData,
): Promise<DoorSignInState> {
  return doorSignIn('staff', formData)
}

export async function companySignInAction(
  _prev: DoorSignInState,
  formData: FormData,
): Promise<DoorSignInState> {
  return doorSignIn('company', formData)
}

export async function completeTwoFactorAction(
  _prev: DoorSignInState,
  formData: FormData,
): Promise<DoorSignInState> {
  const parsed = twoFactorCodeSchema.safeParse({ code: formData.get('code') })
  if (!parsed.success) {
    return { needsTwoFactor: true, fieldErrors: { code: parsed.error.issues.map((i) => i.message) } }
  }

  const jar = await cookies()
  const raw = jar.get(PREAUTH_COOKIE)?.value
  if (!raw) {
    return { error: 'Sign-in expired. Enter your email or mobile and password again.' }
  }

  const preauth = openPreAuth(raw, env.AUTH_SECRET)
  if (!preauth) {
    jar.delete(PREAUTH_COOKIE)
    return { error: 'Sign-in expired. Enter your email or mobile and password again.' }
  }

  try {
    await verifyLoginSecondFactor({
      userId: preauth.userId,
      challengeId: preauth.challengeId,
      code: parsed.data.code,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That code is not correct.'
    return { needsTwoFactor: true, error: message, twoFactorHint: 'either' }
  }

  const ticket = sealLoginTicket(
    {
      userId: preauth.userId,
      audience: preauth.audience,
      exp: Date.now() + LOGIN_TICKET_TTL_MS,
    },
    env.AUTH_SECRET,
  )

  jar.delete(PREAUTH_COOKIE)

  try {
    await signIn('credentials', {
      loginTicket: ticket,
      redirectTo: REDIRECT[preauth.audience],
    })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: GENERIC }
    }
    throw error
  }
}

export async function cancelTwoFactorAction(): Promise<DoorSignInState> {
  const jar = await cookies()
  jar.delete(PREAUTH_COOKIE)
  return {}
}
