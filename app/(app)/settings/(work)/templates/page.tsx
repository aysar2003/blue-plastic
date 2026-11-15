import type { Metadata } from 'next'

import { TemplatesHub } from '@/app/(app)/settings/(work)/templates/templates-hub'
import { requireOrgContext } from '@/server/auth/context'
import { loadFormCustomization } from '@/server/services/form-customization'
import * as organizationService from '@/server/services/organization.service'

export const metadata: Metadata = { title: 'Templates' }

export default async function TemplatesPage() {
  const ctx = await requireOrgContext('org:read')
  const [template, invoiceForm, salesReceiptForm, otherSalesForm] = await Promise.all([
    organizationService.getDocumentTemplate(ctx),
    loadFormCustomization(ctx, 'sales', 'INVOICE'),
    loadFormCustomization(ctx, 'sales', 'SALES_RECEIPT'),
    loadFormCustomization(ctx, 'sales', 'CREDIT_MEMO'),
  ])

  return (
    <TemplatesHub
      template={template}
      canEdit={ctx.permissions.has('org:update')}
      invoiceForm={invoiceForm}
      salesReceiptForm={salesReceiptForm}
      otherSalesForm={otherSalesForm}
    />
  )
}
