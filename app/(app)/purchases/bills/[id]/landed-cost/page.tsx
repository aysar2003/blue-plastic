import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { LandedCostForm } from '@/components/purchases/landed-cost-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as landedCostService from '@/server/services/landed-cost.service'

export const metadata: Metadata = { title: 'Allocate landed cost' }

export default async function BillLandedCostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext('inventory:adjust')
  const preview = await landedCostService.preview(ctx, id).catch(() => null)
  if (!preview) notFound()
  const currency = ctx.organization.baseCurrency

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <PageHeader
        title={`Landed cost · ${preview.bill.number}`}
        description={
          preview.bill.vendorName
            ? `Allocate freight/duty from this bill onto inventory for ${preview.bill.vendorName}.`
            : 'Allocate freight/duty from this bill onto inventory receipts.'
        }
        actions={
          <Link href={`/purchases/bills/${id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to bill
          </Link>
        }
      />

      {preview.batches.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Already posted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {preview.batches.map((batch) => (
              <p key={batch.id}>
                {formatMoney(batch.total, currency)}
                {batch.memo ? ` · ${batch.memo}` : ''}
                {batch.journalId ? ' · journal posted' : ''}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-4 sm:p-6">
          {preview.bill.status === 'DRAFT' || preview.bill.status === 'PENDING_APPROVAL' ? (
            <p className="text-sm text-muted-foreground">Post the bill before allocating freight to stock.</p>
          ) : (
            <LandedCostForm preview={preview} currency={currency} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
