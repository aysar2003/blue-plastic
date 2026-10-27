import { notFound } from 'next/navigation'

import { DocumentPackView } from '@/components/print/document-pack-view'
import { listExportHref } from '@/lib/document-pack'
import { isProposal, bySlug, byType } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import * as approvalService from '@/server/services/approval.service'
import { loadSalesPack } from '@/server/services/document-pack.service'

export const metadata = { title: 'Print papers' }

export default async function SalesPackPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { type } = await params
  const config = bySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('invoice:read')
  const search = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string' && value) query.set(key, value)
  }

  const [documents, organization, template] = await Promise.all([
    loadSalesPack(ctx, config.type, query),
    organizationService.get(ctx),
    organizationService.getPrintTemplate(ctx),
  ])

  const approvals = await approvalService.latestApprovals(
    ctx.orgId,
    documents.map((row) => row.id),
  )
  const paper = config.singular.toLowerCase()
  const filename = `${config.slug}-pack.pdf`
  const queryString = query.toString()

  return (
    <DocumentPackView
      documents={documents}
      organization={organization}
      template={{ ...template, paperStyle: 'trade' }}
      baseCurrency={ctx.organization.baseCurrency}
      printedBy={ctx.user.name}
      title={config.plural}
      paper={paper}
      backHref={`/sales/${config.slug}${queryString ? `?${queryString}` : ''}`}
      pdfHref={`/api/sales/pack/${config.slug}/pdf${queryString ? `?${queryString}` : ''}`}
      excelHref={listExportHref(config.slug, Object.fromEntries(query.entries()))}
      filename={filename}
      configOf={(documentType) => byType(documentType as typeof config.type)}
      runningTotals={isProposal(config.type)}
      emptyHref={`/sales/${config.slug}`}
      emptyLabel={`Back to ${config.plural.toLowerCase()}`}
      approvals={Object.fromEntries(approvals)}
    />
  )
}
