import { notFound } from 'next/navigation'

import { DocumentPackView } from '@/components/print/document-pack-view'
import { listExportHref } from '@/lib/document-pack'
import { purchaseBySlug, purchaseByType } from '@/lib/purchase-types'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import { loadPurchasePack } from '@/server/services/document-pack.service'

export const metadata = { title: 'Print papers' }

export default async function PurchasePackPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { type } = await params
  const config = purchaseBySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('bill:read')
  const search = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string' && value) query.set(key, value)
  }

  const [documents, organization, template] = await Promise.all([
    loadPurchasePack(ctx, config.type, query),
    organizationService.get(ctx),
    organizationService.getPrintTemplate(ctx),
  ])

  const paper = config.singular.toLowerCase()
  const filename = `${config.slug}-pack.pdf`
  const queryString = query.toString()

  return (
    <DocumentPackView
      documents={documents}
      organization={organization}
      template={template}
      baseCurrency={ctx.organization.baseCurrency}
      printedBy={ctx.user.name}
      title={config.plural}
      paper={paper}
      backHref={`/purchases/${config.slug}${queryString ? `?${queryString}` : ''}`}
      pdfHref={`/api/purchases/pack/${config.slug}/pdf${queryString ? `?${queryString}` : ''}`}
      excelHref={listExportHref(config.slug, Object.fromEntries(query.entries()))}
      filename={filename}
      configOf={(documentType) => purchaseByType(documentType as typeof config.type)}
      vendorPaper
      emptyHref={`/purchases/${config.slug}`}
      emptyLabel={`Back to ${config.plural.toLowerCase()}`}
    />
  )
}
