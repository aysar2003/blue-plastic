import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  MODULE_FLAG_LABELS,
  MODULE_FLAGS,
  parseFeatureFlags,
  type ModuleFlag,
} from '@/lib/feature-flags'
import { platformCatalogApps } from '@/lib/platform-apps-catalog'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as appAccessService from '@/server/services/app-access.service'

import { PlatformAppsCatalog } from './platform-apps-catalog'

export const metadata: Metadata = { title: 'Apps' }

/**
 * Platform console apps store: catalog every grantable module and show
 * company coverage. Manage grants per company via Limits.
 */
export default async function PlatformAppsPage() {
  const ctx = await requireOrgContext('org:update')
  if (!ctx.isSystemOwner) redirect('/databases')

  const [organizations, pendingAppRequests] = await Promise.all([
    db.organization.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, featureFlags: true },
    }),
    appAccessService.listPendingForOwner(ctx),
  ])

  const companies = organizations.map((org) => {
    const flags = parseFeatureFlags(org.featureFlags)
    const granted = MODULE_FLAGS.filter((key) => flags.grantedModules[key])
    return {
      id: org.id,
      name: org.name,
      grantedCount: granted.length,
      grantedLabels: granted.map((key) => MODULE_FLAG_LABELS[key].label),
      granted,
    }
  })

  const grantCounts = Object.fromEntries(MODULE_FLAGS.map((key) => [key, 0])) as Record<
    ModuleFlag,
    number
  >
  for (const company of companies) {
    for (const key of company.granted) grantCounts[key] += 1
  }

  const missingByModule = Object.fromEntries(
    MODULE_FLAGS.map((key) => [
      key,
      companies
        .filter((company) => !company.granted.includes(key))
        .map((company) => ({ id: company.id, name: company.name })),
    ]),
  ) as Record<ModuleFlag, { id: string; name: string }[]>

  return (
    <PlatformAppsCatalog
      apps={platformCatalogApps()}
      grantCounts={grantCounts}
      companyTotal={companies.length}
      missingByModule={missingByModule}
      companies={companies.map(({ id, name, grantedLabels, grantedCount }) => ({
        id,
        name,
        grantedLabels,
        grantedCount,
      }))}
      pendingRequests={pendingAppRequests.map((row) => ({
        ...row,
        at: row.at.toISOString(),
      }))}
      timeZone={ctx.organization.timeZone}
    />
  )
}
