/**
 * Main company + sub-companies (one level).
 *
 * A main company has `parentOrgId = null` and up to MAX_SUB_COMPANIES children.
 * Books stay separate; group admins roll up reports across the tree.
 */

export const MAX_SUB_COMPANIES = 2

export type CompanyGroupKind = 'main' | 'sub' | 'standalone'

export type GroupReportView = 'one' | 'each' | 'combined'

export type GroupCompanyOption = {
  id: string
  name: string
  parentOrgId: string | null
  baseCurrency: string
}

/** Label for the No Company Open list and reports. */
export function companyGroupKind(input: {
  parentOrgId: string | null
  childCount: number
}): CompanyGroupKind {
  if (input.parentOrgId) return 'sub'
  if (input.childCount > 0) return 'main'
  return 'standalone'
}

export function companyGroupLabel(kind: CompanyGroupKind): string {
  if (kind === 'main') return 'Main'
  if (kind === 'sub') return 'Sub'
  return 'Solo'
}

/**
 * Apply the URL view (one / each / combined) to the allowed group.
 * `org` names one company when view is `one`.
 */
export function applyGroupReportView(
  scope: {
    orgIds: string[] | 'all'
    rootOrgId: string | null
    title: string
    companies: GroupCompanyOption[]
  },
  input: { view?: string | null; org?: string | null },
): {
  view: GroupReportView
  selectedOrgId: string | null
  orgIds: string[] | 'all'
  title: string
} {
  const allowed =
    scope.orgIds === 'all'
      ? new Set(scope.companies.map((row) => row.id))
      : new Set(scope.orgIds)

  const requested = input.view === 'one' || input.view === 'combined' ? input.view : 'each'
  const pick =
    input.org && allowed.has(input.org)
      ? input.org
      : scope.rootOrgId && allowed.has(scope.rootOrgId)
        ? scope.rootOrgId
        : (scope.companies[0]?.id ?? null)

  if (requested === 'one' && pick) {
    const name = scope.companies.find((row) => row.id === pick)?.name
    return {
      view: 'one',
      selectedOrgId: pick,
      orgIds: [pick],
      title: name ?? 'One company',
    }
  }

  if (requested === 'combined') {
    return {
      view: 'combined',
      selectedOrgId: null,
      orgIds: scope.orgIds,
      title: scope.title.replace(/ · group$/, ' · combined'),
    }
  }

  return {
    view: 'each',
    selectedOrgId: null,
    orgIds: scope.orgIds,
    title: scope.title,
  }
}

/** A staff membership, used to collapse companies into their group on Users. */
export type UserCompanyMembership = {
  role: string
  status: string
  organization: {
    id: string
    name: string
    parentOrgId: string | null
    parent: { id: string; name: string } | null
  }
}

export type GroupedUserCompany = {
  rootId: string
  name: string
  companyCount: number
  role: string
  status: string
}

const ROLE_RANK: Record<string, number> = {
  OWNER: 0,
  ADMIN: 1,
  ACCOUNTANT: 2,
  BOOKKEEPER: 3,
  SALES: 4,
  STORE_KEEPER: 5,
  VIEWER: 6,
  CUSTOM: 7,
}

function strongerRole(a: string, b: string) {
  return (ROLE_RANK[a] ?? 99) <= (ROLE_RANK[b] ?? 99) ? a : b
}

function louderStatus(a: string, b: string) {
  if (a === 'SUSPENDED' || b === 'SUSPENDED') return 'SUSPENDED'
  if (a === 'INVITED' || b === 'INVITED') return 'INVITED'
  return 'ACTIVE'
}

/**
 * Collapse a person's companies into main + sub groups, so related companies
 * sit together instead of listing every database on the users table.
 */
export function groupUserCompanies(
  memberships: UserCompanyMembership[],
): GroupedUserCompany[] {
  const groups = new Map<
    string,
    { name: string; companyIds: Set<string>; role: string; status: string }
  >()

  for (const membership of memberships) {
    const org = membership.organization
    const rootId = org.parentOrgId ?? org.id
    const name = org.parent?.name ?? org.name
    const existing = groups.get(rootId)
    if (!existing) {
      groups.set(rootId, {
        name,
        companyIds: new Set([org.id]),
        role: membership.role,
        status: membership.status,
      })
      continue
    }
    existing.companyIds.add(org.id)
    if (!org.parentOrgId) existing.name = org.name
    existing.role = strongerRole(existing.role, membership.role)
    existing.status = louderStatus(existing.status, membership.status)
  }

  return [...groups.entries()]
    .map(([rootId, group]) => ({
      rootId,
      name: group.name,
      companyCount: group.companyIds.size,
      role: group.role,
      status: group.status,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
