import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { PaymentForm } from '@/components/sales/payment-form'
import { toCalendarDate, today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { loadFormOptions } from '@/server/services/sales-options'
import * as paymentService from '@/server/services/payment.service'
import { openInvoicesForCustomer } from '../../actions'

export const metadata: Metadata = { title: 'Edit payment' }

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext('payment:update')
  const [payment, options, invoices] = await Promise.all([
    paymentService.get(ctx, id).catch(() => null),
    loadFormOptions(ctx),
    paymentService.invoicesForEdit(ctx, id).catch(() => []),
  ])
  if (!payment) notFound()
  if (payment.status === 'VOID') notFound()

  return (
    <>
      <PageHeader
        title={`Edit payment ${payment.number}`}
        description="Change the receipt or what it settles. Changing amount, date, customer, or deposit account reverses the original entry and posts a replacement."
      />

      <PaymentForm
        customers={options.customers}
        depositAccounts={options.depositAccounts}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        loadOpenInvoices={openInvoicesForCustomer}
        documentNumber={payment.number}
        payment={{
          id: payment.id,
          customerId: payment.customer.id,
          date: toCalendarDate(payment.date),
          amount: payment.amount,
          method: payment.method,
          depositAccountId: payment.depositAccount.id,
          reference: payment.reference,
          memo: payment.memo,
          applications: payment.applications.map((application) => ({
            invoiceId: application.invoice.id,
            amount: application.amount,
          })),
          invoices: invoices.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            date: invoice.date.toISOString(),
            dueDate: invoice.dueDate?.toISOString() ?? null,
            balance: invoice.balance,
          })),
        }}
      />
    </>
  )
}
