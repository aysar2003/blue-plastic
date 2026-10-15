import { maySwitchCompanies } from '@/lib/company-access'
import { loadCompanyAccess } from '@/server/auth/company-access'

/**
 * Where to send someone after sign-in.
 *
 * Customer portal logins go to `/portal`. People who may leave their company
 * (system owner, or admin with Connect) land on the No Company Open list —
 * Odoo-style. Staff go straight into the apps.
 */
export async function afterSignInPath(
  userId: string,
): Promise<'/databases' | '/dashboard' | '/portal'> {
  const access = await loadCompanyAccess(userId)
  if (!access) return '/dashboard'

  const home =
    access.memberships.find((membership) => membership.orgId === access.homeOrgId) ??
    access.memberships[0]
  if (home?.role === 'CUSTOMER') return '/portal'

  if (
    maySwitchCompanies({
      isSystemOwner: access.isSystemOwner,
      memberships: access.memberships,
    })
  ) {
    return '/databases'
  }
  return '/dashboard'
}
