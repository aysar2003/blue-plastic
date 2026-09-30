import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { DocumentForm } from '@/components/sales/document-form'
import { buttonVariants } from '@/components/ui/button'
import { today } from '@/lib/date'
import { describeTerm } from '@/lib/payment-terms'
import { bySlug } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import { loadFormOptions } from '@/server/services/sales-options'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  const config = bySlug((await params).type)
  return { title: `New ${config?.singular.toLowerCase() ?? 'document'}` }
}

export default async function NewSalesDocumentPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const config = bySlug((await params).type)
  if (!config) notFound()

  const ctx = await requireOrgContext(config.createPermission)
  const options = await loadFormOptions(ctx)

  return (
    <>
      <Link
        href="/sales"
        className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} mb-3 -ml-2`}
      >
        <ArrowLeftIcon /> Sales
      </Link>

      <PageHeader title={`New ${config.singular.toLowerCase()}`} description={config.effect} />

      <DocumentForm
        config={config}
        customers={options.customers}
        items={options.items}
        taxCodes={options.taxCodes}
        depositAccounts={options.depositAccounts}
        terms={options.terms.map((term) => ({ id: term.id, label: `${term.name} — ${describeTerm(term)}` }))}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        organizationName={ctx.organization.name}
      />
    </>
  )
}
