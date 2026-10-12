import type { Metadata } from 'next'

import { TemplatesHub } from '@/app/(app)/settings/(work)/templates/templates-hub'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'

export const metadata: Metadata = { title: 'Templates' }

export default async function TemplatesPage() {
  const ctx = await requireOrgContext('org:read')
  const template = await organizationService.getDocumentTemplate(ctx)

  return (
    <TemplatesHub template={template} canEdit={ctx.permissions.has('org:update')} />
  )
}
