import 'server-only'

import { parseFeatureFlags } from '@/lib/feature-flags'
import { db } from '@/server/db'
import { notFound } from '@/server/errors'
import { getStoredObject } from '@/server/files/object-store'

/**
 * Public logo for the customer-portal login page.
 * Only served when that company has the portal feature on.
 */
export async function readPublicPortalLogo(orgId: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      logoStorageKey: true,
      logoContentType: true,
      featureFlags: true,
    },
  })
  if (!org?.logoStorageKey || !org.logoContentType) throw notFound('Logo')
  if (!parseFeatureFlags(org.featureFlags).enableCustomerPortal) throw notFound('Logo')

  const bytes = await getStoredObject(`branding/${org.logoStorageKey}`)
  return {
    bytes,
    contentType: org.logoContentType,
    filename: `${org.name.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'logo'}.png`,
  }
}
