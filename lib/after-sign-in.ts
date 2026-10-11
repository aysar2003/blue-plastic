import { maySwitchCompanies } from '@/lib/company-access'
import { loadCompanyAccess } from '@/server/auth/company-access'

/**
 * Where to send someone after sign-in.
 *
 * People who may leave their company (system owner, or admin with Connect) land
 * on the No Company Open list — Odoo-style. Staff go straight into the apps.
 */
export async function afterSignInPath(userId: string): Promise<'/databases' | '/dashboard'> {
  const access = await loadCompanyAccess(userId)
  if (
    access &&
    maySwitchCompanies({
      isSystemOwner: access.isSystemOwner,
      memberships: access.memberships,
    })
  ) {
    return '/databases'
  }
  return '/dashboard'
}
