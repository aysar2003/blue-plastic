/**
 * Who may leave their own company.
 *
 * The system owner sees every database. An admin can be granted Connect.
 * Everyone else is sent to the company they work for, the way an Odoo user
 * opens the database they belong to and never the database list.
 */

export type CompanyAccessMembership = {
  orgId: string
  role: string
  canConnect: boolean
}

export function maySwitchCompanies(input: {
  isSystemOwner: boolean
  memberships: Pick<CompanyAccessMembership, 'role' | 'canConnect'>[]
}): boolean {
  if (input.isSystemOwner) return true
  return input.memberships.some((membership) => membership.role === 'ADMIN' && membership.canConnect)
}

/** The company a person is sent to when they are not allowed to switch. */
export function homeCompanyId(
  homeOrgId: string | null | undefined,
  memberships: { orgId: string }[],
): string | null {
  if (memberships.length === 0) return null
  if (homeOrgId) {
    const home = memberships.find((membership) => membership.orgId === homeOrgId)
    if (home) return home.orgId
  }
  return memberships[0]?.orgId ?? null
}

/**
 * Org the session should open.
 *
 * A switcher keeps the company they asked for (the system owner may name one
 * they have no membership in). Everyone else is put back in their home company
 * even if the token still names another one.
 */
export function sessionCompanyId(input: {
  isSystemOwner: boolean
  maySwitch: boolean
  sessionOrgId: string
  homeOrgId: string | null | undefined
  memberships: { orgId: string }[]
}): string | null {
  if (input.maySwitch) {
    if (input.isSystemOwner) return input.sessionOrgId
    if (input.memberships.some((membership) => membership.orgId === input.sessionOrgId)) {
      return input.sessionOrgId
    }
  }
  return homeCompanyId(input.homeOrgId, input.memberships)
}
