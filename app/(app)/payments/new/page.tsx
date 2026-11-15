import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { SalesPaperFrame } from '@/components/sales/paper-width'
import { PaymentForm } from '@/components/sales/payment-form'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { loadFormOptions } from '@/server/services/sales-options'
import * as paymentService from '@/server/services/payment.service'
import { openInvoicesForCustomer } from '../actions'

export const metadata: Metadata = { title: 'Receive payment' }

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('payment:create')
  const query = await searchParams
  const copyId = typeof query.copy === 'string' ? query.copy : undefined
  const [options, documentNumber, copySource] = await Promise.all([
    loadFormOptions(ctx),
    peekDocumentNumber(db, ctx.orgId, 'CUSTOMER_PAYMENT'),
    copyId ? paymentService.get(ctx, copyId).catch(() => null) : Promise.resolve(null),
  ])
  if (copyId && !copySource) notFound()

  const calendarToday = today(ctx.organization.timeZone)
  const requested = typeof query.customer === 'string' ? query.customer : undefined
  const initialCustomerId = options.customers.some((customer) => customer.id === requested)
    ? requested
    : undefined

  const openInvoices = copySource
    ? await paymentService.openInvoicesFor(ctx, copySource.customer.id)
    : []

  const copySeed = copySource
    ? {
        customerId: copySource.customer.id,
        date: calendarToday,
        amount: copySource.amount,
        method: copySource.method,
        depositAccountId: copySource.depositAccount.id,
        reference: copySource.reference,
        memo: copySource.memo,
        applications: [] as { invoiceId: string; amount: string }[],
        invoices: openInvoices.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          date: invoice.date.toISOString(),
          dueDate: invoice.dueDate?.toISOString() ?? null,
          balance: invoice.balance,
          overdue: invoice.overdue,
        })),
      }
    : undefined

  return (
    <SalesPaperFrame>
      <PageHeader
        title={copySource ? `Copy payment ${copySource.number}` : 'Receive payment'}
        className="mb-2 pb-2"
      />

      <PaymentForm
        customers={options.customers}
        depositAccounts={options.depositAccounts}
        today={calendarToday}
        currency={ctx.organization.baseCurrency}
        loadOpenInvoices={openInvoicesForCustomer}
        initialCustomerId={copySeed ? undefined : initialCustomerId}
        documentNumber={documentNumber}
        payment={copySeed}
        copiedFromNumber={copySource?.number}
      />
    </SalesPaperFrame>
  )
}
