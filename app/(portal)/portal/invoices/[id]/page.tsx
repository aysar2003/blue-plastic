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
import * as organizationService from '@/server/services/organization.service'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Invoice' }
export const dynamic = 'force-dynamic'

export default async function PortalInvoicePage({
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
    document = await portalService.getInvoice(ctx, id)
  } catch (error) {
    // Only a missing invoice becomes the soft 404. Real failures must surface —
    // they were previously swallowed (sales.get catch → null → 404).
    if (isAppError(error) && error.status === 404) notFound()
    throw error
  }

  const [organization, template] = await Promise.all([
    organizationService.get(ctx),
    organizationService.getDocumentTemplate(ctx),
  ])
  const config = byType(document.type)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <Link
            href="/portal/invoices"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back to invoices
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Invoice {document.number}
          </h1>
          <p className="text-sm text-muted-foreground">View only — you can print or download a PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PortalPrintButton />
          <a
            href={`/api/sales/${document.id}/pdf`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Download PDF
          </a>
        </div>
      </div>

      <MerchantInvoice
        document={document}
        organization={organization}
        template={template}
        config={config}
        baseCurrency={ctx.organization.baseCurrency}
        printedBy={ctx.user.name}
        ledger
      />
    </div>
  )
}
