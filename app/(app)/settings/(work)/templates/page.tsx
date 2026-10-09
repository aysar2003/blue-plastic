import type { Metadata } from 'next'

import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import { TemplateForm } from './template-form'

export const metadata: Metadata = { title: 'Templates' }

export default async function TemplatesPage() {
  const ctx = await requireOrgContext('org:read')
  const template = await organizationService.getDocumentTemplate(ctx)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One paper for the whole system. Edit it here, or download the file, change it, and upload it back.
        </p>
      </div>
      <TemplateForm template={template} canEdit={ctx.permissions.has('org:update')} />
    </div>
  )
}
