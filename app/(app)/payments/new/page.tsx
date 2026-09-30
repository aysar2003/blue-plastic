import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { PaymentForm } from '@/components/sales/payment-form'
import { buttonVariants } from '@/components/ui/button'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { loadFormOptions } from '@/server/services/sales-options'
import { openInvoicesForCustomer } from '../actions'

export const metadata: Metadata = { title: 'Receive payment' }

export default async function NewPaymentPage() {
  const ctx = await requireOrgContext('payment:create')
  const options = await loadFormOptions(ctx)

  return (
    <>
      <Link
        href="/sales"
        className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} mb-3 -ml-2`}
      >
        <ArrowLeftIcon /> Sales
      </Link>

      <PageHeader
        title="Receive payment"
        description="Money in, receivables down. Anything you do not apply stays as a credit on the customer's account."
      />

      <PaymentForm
        customers={options.customers}
        depositAccounts={options.depositAccounts}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        loadOpenInvoices={openInvoicesForCustomer}
      />
    </>
  )
}
