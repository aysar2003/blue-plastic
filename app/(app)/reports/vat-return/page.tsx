import type { Metadata } from 'next'
import Link from 'next/link'
import { PercentIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { DEFAULT_VAT_BOX_LABELS } from '@/lib/localization/packs'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as statutoryExport from '@/server/services/statutory-export.service'
import { ReportControls } from '../report-controls'
import { readSettings, type SearchParams } from '../params'

export const metadata: Metadata = { title: 'VAT return' }

export default async function VatReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')

  if (!ctx.features.enableTax) {
    return (
      <EmptyState
        icon={PercentIcon}
        title="Tax is turned off"
        description="Turn tax on under Settings → Tax to build a VAT return from posted tax lines."
      />
    )
  }

  const query = await searchParams
  const settings = readSettings(query, ctx.organization, 'this-quarter')
  const pack = await statutoryExport.vatReturnExport(ctx, settings.range)
  const currency = ctx.organization.baseCurrency
  const boxes = pack.boxes
  const labels = pack.boxLabels ?? DEFAULT_VAT_BOX_LABELS
  const qs = `from=${settings.range.from}&to=${settings.range.to}`

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="VAT return"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · jurisdiction ${boxes.jurisdiction}`}
        actions={
          <>
            <Link
              href={`/api/reports/vat-return?${qs}`}
              className={buttonVariants({ size: 'sm' })}
            >
              Download Excel
            </Link>
            <Link
              href={`/api/reports/vat-return?${qs}&format=json`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Download JSON
            </Link>
          </>
        }
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range' }}
      />

      <Card className="mt-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">{labels.box1}</p>
            <p className="tabular font-medium">{formatMoney(boxes.box1TaxableSupplies, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{labels.box2}</p>
            <p className="tabular font-medium">{formatMoney(boxes.box2OutputVat, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{labels.box3}</p>
            <p className="tabular font-medium">{formatMoney(boxes.box3TaxablePurchases, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{labels.box4}</p>
            <p className="tabular font-medium">{formatMoney(boxes.box4InputVat, currency)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">{labels.box5}</p>
            <p className="tabular text-lg font-semibold">
              {formatMoney(boxes.box5NetVatDue, currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Built from posted sales and purchase tax lines (same basis as Sales Tax Liability). Negative
        Box 5 means a reclaim.
      </p>
    </>
  )
}
