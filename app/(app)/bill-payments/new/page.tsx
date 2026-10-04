import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { BillPaymentForm } from '@/components/purchases/bill-payment-form'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { loadPurchaseOptions } from '@/server/services/purchase-options'
import { vendorPayables } from '@/app/(app)/purchases/actions'

export const metadata: Metadata = { title: 'Pay bills' }

export default async function NewBillPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('expense:create')
  const vendorParam = (await searchParams).vendor
  const requestedVendor = typeof vendorParam === 'string' ? vendorParam : undefined
  const [options, documentNumber] = await Promise.all([
    loadPurchaseOptions(ctx),
    peekDocumentNumber(db, ctx.orgId, 'BILL_PAYMENT'),
  ])
  const vendors = options.vendors.map((vendor) => ({ id: vendor.id, label: vendor.label }))
  const initialVendorId = vendors.some((vendor) => vendor.id === requestedVendor) ? requestedVendor : undefined

  return (
    <>

      <PageHeader
        title="Pay bills"
        description="Money out, payables down. Tick what you are settling — one payment can cover several bills — and the account you are paying from shows what it holds."
      />

      <BillPaymentForm
        vendors={vendors}
        paymentAccounts={options.paymentAccounts}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        loadPayables={vendorPayables}
        initialVendorId={initialVendorId}
        documentNumber={documentNumber}
      />
    </>
  )
}
