import 'server-only'

import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

import { env } from '@/lib/env'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { openSecret, sealSecret } from '@/lib/sealed-secret'
import { buildOtpAuthUrl, generateTotpSecret, verifyTotp } from '@/lib/totp'
import { normalizePhone } from '@/lib/phone'
import { db } from '@/server/db'
import { forbidden, notFound, precondition, validation } from '@/server/errors'
import { verifyPassword } from '@/server/auth/password'
import { sendAuthEmailOtp } from '@/server/services/platform-notify.service'

const OTP_TTL_MS = 10 * 60 * 1000
export const LOGIN_OTP_RESEND_COOLDOWN_MS = 60 * 1000
const RESEND_COOLDOWN_MS = LOGIN_OTP_RESEND_COOLDOWN_MS
const MAX_ATTEMPTS = 5

export type TwoFactorStatus = {
  totpEnabled: boolean
  otp2faEnabled: boolean
  phone: string | null
  email: string
}

function pepperHash(code: string): string {
  return createHash('sha256').update(`${env.AUTH_SECRET}:otp:${code}`).digest('hex')
}

function codesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function randomOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      totpEnabledAt: true,
      otp2faEnabledAt: true,
    },
  })
  if (!user) throw notFound('User')
  return {
    email: user.email,
    phone: user.phone,
    totpEnabled: Boolean(user.totpEnabledAt),
    otp2faEnabled: Boolean(user.otp2faEnabledAt),
  }
}

export function userNeedsTwoFactor(user: {
  totpEnabledAt: Date | null
  otp2faEnabledAt: Date | null
  isSystemOwner?: boolean
}): boolean {
  // Platform owners always complete a second factor (email OTP at minimum).
  if (user.isSystemOwner) return true
  return Boolean(user.totpEnabledAt || user.otp2faEnabledAt)
}

async function createChallenge(userId: string, purpose: string, code: string) {
  const recent = await db.authChallenge.findFirst({
    where: {
      userId,
      purpose,
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    select: { id: true, createdAt: true },
  })
  if (recent) {
    const waitSec = Math.max(
      1,
      Math.ceil((recent.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000),
    )
    throw precondition(`Wait ${waitSec}s before requesting another code.`)
  }

  return db.authChallenge.create({
    data: {
      userId,
      purpose,
      codeHash: pepperHash(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  })
}

/** Seconds until a new LOGIN_OTP may be issued (0 = can send now). */
export async function loginOtpResendWaitSeconds(userId: string): Promise<number> {
  const recent = await db.authChallenge.findFirst({
    where: {
      userId,
      purpose: 'LOGIN_OTP',
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!recent) return 0
  return Math.max(
    0,
    Math.ceil((recent.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000),
  )
}

export async function beginLoginOtp(userId: string): Promise<{ challengeId: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, otp2faEnabledAt: true, totpEnabledAt: true, isSystemOwner: true },
  })
  if (!user) throw notFound('User')
  const forceEmailOtp = user.isSystemOwner || Boolean(user.otp2faEnabledAt)
  if (!forceEmailOtp && !user.totpEnabledAt) {
    throw precondition('Two-factor authentication is not enabled.')
  }

  // Always create a LOGIN_OTP challenge so email OTP users get a code.
  // TOTP-only users still get a challenge row (unused) so the cookie has an id;
  // verify accepts TOTP without consuming email hash.
  const code = randomOtp()
  const challenge = await createChallenge(userId, 'LOGIN_OTP', code)

  if (forceEmailOtp) {
    // Await delivery so the code is in the inbox before the OTP screen.
    // Challenge already exists — login still works from the dev console log if mail fails.
    try {
      await sendAuthEmailOtp(user.email, code)
    } catch (error) {
      console.error('Login OTP email failed', error)
      if (env.NODE_ENV !== 'production') {
        console.info(`[auth-otp] fallback ${user.email} → ${code}`)
      }
    }
  }

  return { challengeId: challenge.id }
}

export async function verifyLoginSecondFactor(input: {
  userId: string
  challengeId: string
  code: string
}): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      totpEnabledAt: true,
      totpSecretSealed: true,
      otp2faEnabledAt: true,
      isSystemOwner: true,
    },
  })
  if (!user) throw notFound('User')

  const challenge = await db.authChallenge.findFirst({
    where: {
      id: input.challengeId,
      userId: input.userId,
      purpose: 'LOGIN_OTP',
      consumedAt: null,
    },
  })
  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    throw validation('That code has expired. Sign in again.')
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw validation('Too many attempts. Sign in again.')
  }

  const code = input.code.trim()
  let ok = false

  if (user.totpEnabledAt && user.totpSecretSealed) {
    const secret = openSecret(user.totpSecretSealed, env.AUTH_SECRET)
    if (secret && verifyTotp(secret, code)) ok = true
  }

  const emailOtpAllowed = user.otp2faEnabledAt || user.isSystemOwner
  if (!ok && emailOtpAllowed && codesMatch(challenge.codeHash, pepperHash(code))) {
    ok = true
  }

  if (!ok) {
    await db.authChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    throw validation('That code is not correct.')
  }

  await db.authChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  })
}

export async function updatePhone(userId: string, phoneRaw: string | null): Promise<{ phone: string | null }> {
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null
  if (phoneRaw && phoneRaw.trim() && !phone) {
    throw validation('Enter a valid mobile number with country code.', {
      phone: ['Enter a valid mobile number with country code.'],
    })
  }

  if (phone) {
    const taken = await db.user.findFirst({
      where: { phone, NOT: { id: userId } },
      select: { id: true },
    })
    if (taken) {
      throw validation('That mobile number is already used on another login.', {
        phone: ['That mobile number is already used on another login.'],
      })
    }
  }

  const after = await db.user.update({
    where: { id: userId },
    data: { phone },
    select: { phone: true },
  })
  return after
}

/** Start authenticator setup — returns secret + otpauth URL (confirm before enable). */
export async function beginTotpSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabledAt: true },
  })
  if (!user) throw notFound('User')
  if (user.totpEnabledAt) throw precondition('Authenticator is already on.')

  const secret = generateTotpSecret()
  await db.user.update({
    where: { id: userId },
    data: { totpSecretSealed: sealSecret(secret, env.AUTH_SECRET) },
  })

  return {
    secret,
    otpauthUrl: buildOtpAuthUrl({
      secret,
      accountName: user.email,
      issuer: PRODUCT_NAME,
    }),
  }
}

export async function confirmTotpSetup(userId: string, code: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecretSealed: true, totpEnabledAt: true },
  })
  if (!user?.totpSecretSealed) throw precondition('Start authenticator setup first.')
  if (user.totpEnabledAt) throw precondition('Authenticator is already on.')

  const secret = openSecret(user.totpSecretSealed, env.AUTH_SECRET)
  if (!secret || !verifyTotp(secret, code)) {
    throw validation('That authenticator code is not correct.', {
      code: ['That authenticator code is not correct.'],
    })
  }

  await db.user.update({
    where: { id: userId },
    data: { totpEnabledAt: new Date() },
  })
}

export async function disableTotp(userId: string, currentPassword: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, totpEnabledAt: true },
  })
  if (!user?.passwordHash) throw notFound('User')
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw validation('Your current password is not correct.', {
      currentPassword: ['Your current password is not correct.'],
    })
  }

  await db.user.update({
    where: { id: userId },
    data: { totpEnabledAt: null, totpSecretSealed: null },
  })
}

export async function beginEnableEmailOtp(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, otp2faEnabledAt: true },
  })
  if (!user) throw notFound('User')
  if (user.otp2faEnabledAt) throw precondition('Email codes are already on.')

  const code = randomOtp()
  await createChallenge(userId, 'ENABLE_OTP', code)
  await sendAuthEmailOtp(user.email, code)
}

export async function confirmEnableEmailOtp(userId: string, code: string): Promise<void> {
  const challenge = await db.authChallenge.findFirst({
    where: {
      userId,
      purpose: 'ENABLE_OTP',
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    throw validation('That code has expired. Request a new one.')
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw validation('Too many attempts. Request a new code.')
  }

  if (!codesMatch(challenge.codeHash, pepperHash(code.trim()))) {
    await db.authChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    throw validation('That code is not correct.', { code: ['That code is not correct.'] })
  }

  await db.$transaction([
    db.authChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    }),
    db.user.update({
      where: { id: userId },
      data: { otp2faEnabledAt: new Date() },
    }),
  ])
}

export async function disableEmailOtp(userId: string, currentPassword: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
  if (!user?.passwordHash) throw notFound('User')
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw validation('Your current password is not correct.', {
      currentPassword: ['Your current password is not correct.'],
    })
  }

  await db.user.update({
    where: { id: userId },
    data: { otp2faEnabledAt: null },
  })
}

/** Cancel incomplete TOTP setup (secret stored but not confirmed). */
export async function cancelTotpSetup(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpEnabledAt: true },
  })
  if (!user) throw notFound('User')
  if (user.totpEnabledAt) throw forbidden('Authenticator is on — turn it off with your password.')

  await db.user.update({
    where: { id: userId },
    data: { totpSecretSealed: null },
  })
}
