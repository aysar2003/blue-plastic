import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { PaymentForm } from '@/components/sales/payment-form'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { loadFormOptions } from '@/server/services/sales-options'
import { openInvoicesForCustomer } from '../actions'

export const metadata: Metadata = { title: 'Receive payment' }

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('payment:create')
  const [options, query, documentNumber] = await Promise.all([
    loadFormOptions(ctx),
    searchParams,
    peekDocumentNumber(db, ctx.orgId, 'CUSTOMER_PAYMENT'),
  ])
  const requested = typeof query.customer === 'string' ? query.customer : undefined
  const initialCustomerId = options.customers.some((customer) => customer.id === requested)
    ? requested
    : undefined

  return (
    <>

      <PageHeader title="Receive payment" className="mb-2 pb-2" />

      <PaymentForm
        customers={options.customers}
        depositAccounts={options.depositAccounts}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        loadOpenInvoices={openInvoicesForCustomer}
        initialCustomerId={initialCustomerId}
        documentNumber={documentNumber}
      />
    </>
  )
}
