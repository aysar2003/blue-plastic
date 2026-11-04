import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PortalPrintButton } from '@/components/portal/portal-print-button'
import { MerchantInvoice } from '@/components/sales/merchant-invoice'
import { buttonVariants } from '@/components/ui/button'
import { byType } from '@/lib/sales-types'
import { cn } from '@/lib/utils'
import { isAppError } from '@/server/errors'
import { requirePortalContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'
import * as organizationService from '@/server/services/organization.service'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Quote' }
export const dynamic = 'force-dynamic'

export default async function PortalQuotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId).trim()
  if (!id) notFound()

  const ctx = await requirePortalContext()

  let document
  try {
    document = await portalService.getQuote(ctx, id)
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound()
    throw error
  }

  const [organization, template] = await Promise.all([
    organizationService.get(ctx),
    organizationService.getPrintTemplate(ctx),
  ])
  const config = byType(document.type)
  const approvals = await approvalService.latestApprovals(ctx.orgId, [document.id])
  const paperStyle = document.type === 'QUOTATION' ? 'merchant' : 'trade'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <Link
            href="/portal/quotes"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back to quotes
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {config.singular} {document.number}
          </h1>
          <p className="text-sm text-muted-foreground">View only — you can print or download a PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PortalPrintButton />
          <a
            href={`/api/sales/${document.id}/pdf`}
            download
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Download PDF
          </a>
        </div>
      </div>

      <MerchantInvoice
        document={document}
        organization={organization}
        template={{ ...template, paperStyle }}
        config={config}
        baseCurrency={ctx.organization.baseCurrency}
        approval={approvals.get(document.id) ?? null}
        ledger
        hideAccountBalance={document.type === 'QUOTATION'}
      />
    </div>
  )
}
