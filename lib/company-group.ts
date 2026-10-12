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
