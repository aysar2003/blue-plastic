import 'server-only'

import { homeCompanyId } from '@/lib/company-access'
import { db } from '@/server/db'
import { fakeVerify, verifyPassword } from '@/server/auth/password'

export type VerifiedAudience = 'staff' | 'company' | 'portal' | null

export type VerifiedLogin = {
  userId: string
  email: string
  audience: VerifiedAudience
  /** Home membership role when present. */
  role: string | null
}

/**
 * Check email + password without creating a session.
 * Returns null for unknown / wrong password (timing-equalised).
 * Audience is derived so each login page can refuse the wrong door.
 */
export async function verifyCredentials(
  emailRaw: string,
  password: string,
): Promise<VerifiedLogin | null> {
  const email = emailRaw.trim().toLowerCase()
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isSystemOwner: true,
      homeOrgId: true,
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
  }
}
