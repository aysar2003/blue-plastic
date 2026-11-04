import 'server-only'

import { assertSignInRateLimit, clearSignInRateLimit } from '@/lib/auth-rate-limit'
import { homeCompanyId } from '@/lib/company-access'
import { parseLoginIdentifier } from '@/lib/phone'
import { db } from '@/server/db'
import { fakeVerify, verifyPassword } from '@/server/auth/password'
import { userNeedsTwoFactor } from '@/server/services/auth-2fa.service'
import { AppError } from '@/server/errors'

export type VerifiedAudience = 'staff' | 'company' | 'portal' | null

export type VerifiedLogin = {
  userId: string
  email: string
  audience: VerifiedAudience
  /** Home membership role when present. */
  role: string | null
  needsTwoFactor: boolean
  otp2faEnabled: boolean
  totpEnabled: boolean
}

/**
 * Check email-or-phone + password without creating a session.
 * Returns null for unknown / wrong password (timing-equalised).
 * Audience is derived so each login page can refuse the wrong door.
 */
export async function verifyCredentials(
  identifierRaw: string,
  password: string,
): Promise<VerifiedLogin | null> {
  const parsed = parseLoginIdentifier(identifierRaw)
  if (!parsed) {
    await fakeVerify()
    return null
  }

  try {
    assertSignInRateLimit(parsed.value)
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === 'RATE_LIMITED') {
      throw new AppError('RATE_LIMITED', error.message)
    }
    throw error
  }

  const user = await db.user.findUnique({
    where: parsed.kind === 'email' ? { email: parsed.value } : { phone: parsed.value },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isSystemOwner: true,
      homeOrgId: true,
      totpEnabledAt: true,
      otp2faEnabledAt: true,
      memberships: {
        where: { status: 'ACTIVE' },
        select: { orgId: true, role: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!user?.passwordHash) {
    await fakeVerify()
    return null
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return null
  }

  clearSignInRateLimit(parsed.value)

  const homeId = homeCompanyId(user.homeOrgId, user.memberships)
  const membership = homeId
    ? user.memberships.find((row) => row.orgId === homeId)
    : user.memberships[0]
  const role = membership?.role ?? null

  let audience: VerifiedAudience = null
  if (user.isSystemOwner) {
    audience = 'staff'
  } else if (role === 'CUSTOMER') {
    audience = 'portal'
  } else if (membership) {
    audience = 'company'
  }

  return {
    userId: user.id,
    email: user.email,
    audience,
    role,
    needsTwoFactor: userNeedsTwoFactor(user),
    otp2faEnabled: Boolean(user.otp2faEnabledAt),
    totpEnabled: Boolean(user.totpEnabledAt),
  }
}
