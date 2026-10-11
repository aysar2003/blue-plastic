import 'server-only'

import { maySwitchCompanies } from '@/lib/company-access'
import { db } from '@/server/db'

const ACCESS_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  isSystemOwner: true,
  homeOrgId: true,
  memberships: {
    where: { status: 'ACTIVE' as const },
    orderBy: { createdAt: 'asc' as const },
    select: { orgId: true, role: true, canConnect: true, version: true },
  },
}

/** Active memberships plus whether this person may leave their home company. */
export async function loadCompanyAccess(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: ACCESS_SELECT,
  })
  if (!user) return null

  return {
    ...user,
    maySwitch: maySwitchCompanies({
      isSystemOwner: user.isSystemOwner,
      memberships: user.memberships,
    }),
  }
}
