import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { BillPaymentForm } from '@/components/purchases/bill-payment-form'
import { SalesPaperFrame } from '@/components/sales/paper-width'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { loadPurchaseOptions } from '@/server/services/purchase-options'
import * as billPaymentService from '@/server/services/bill-payment.service'
import { vendorPayables } from '@/app/(app)/purchases/actions'

export const metadata: Metadata = { title: 'Pay bills' }

export default async function NewBillPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('expense:create')
  const query = await searchParams
  const vendorParam = query.vendor
  const requestedVendor = typeof vendorParam === 'string' ? vendorParam : undefined
  const copyId = typeof query.copy === 'string' ? query.copy : undefined
  const [options, documentNumber, copySource] = await Promise.all([
    loadPurchaseOptions(ctx),
    peekDocumentNumber(db, ctx.orgId, 'BILL_PAYMENT'),
    copyId ? billPaymentService.get(ctx, copyId).catch(() => null) : Promise.resolve(null),
  ])
  if (copyId && !copySource) notFound()

  const vendors = options.vendors.map((vendor) => ({ id: vendor.id, label: vendor.label }))
  const initialVendorId = vendors.some((vendor) => vendor.id === requestedVendor)
    ? requestedVendor
    : undefined

  const copySeed = copySource
    ? {
        vendorId: copySource.vendor.id,
        method: copySource.method,
        paymentAccountId: copySource.paymentAccount.id,
        reference: copySource.reference,
        memo: copySource.memo,
      }
    : undefined

  return (
    <SalesPaperFrame>
      <PageHeader
        title={copySource ? `Copy bill payment ${copySource.number}` : 'Pay bills'}
        className="mb-2 pb-2"
      />

      <BillPaymentForm
        vendors={vendors}
        paymentAccounts={options.paymentAccounts}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        loadPayables={vendorPayables}
        initialVendorId={copySeed ? undefined : initialVendorId}
        documentNumber={documentNumber}
        document={copySeed}
        copiedFromNumber={copySource?.number}
      />
    </SalesPaperFrame>
  )
}
