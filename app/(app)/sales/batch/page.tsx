import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { BatchInvoiceForm } from '@/components/sales/batch-invoice-form'
import { SalesPaperFrame } from '@/components/sales/paper-width'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export const metadata: Metadata = { title: 'Batch invoices' }

export default async function BatchInvoicesPage() {
  const ctx = await requireOrgContext('invoice:create')
  const [customers, items, taxCodes] = await Promise.all([
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        type: { in: ['SERVICE', 'NON_INVENTORY', 'INVENTORY'] },
      },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    ctx.features.enableTax
      ? db.taxCode.findMany({
          where: { orgId: ctx.orgId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  return (
    <SalesPaperFrame>
      <PageHeader
        title="Invoice a batch"
        description="The same date, item, and price, written as a separate invoice for each customer you tick. One customer’s credit limit does not stop the others."
      />
      <BatchInvoiceForm customers={customers} items={items} taxCodes={taxCodes} today={today()} />
    </SalesPaperFrame>
  )
}
