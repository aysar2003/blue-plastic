import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PlusIcon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { readSort } from '@/components/data/sortable-header'
import { buttonVariants } from '@/components/ui/button'
import { formatDate, formatTransactionDate, toCalendarDate, today } from '@/lib/date'
import { isCollectionOverdue, overdueClock, partyFromContact } from '@/lib/invoice-overdue'
import { DATE_PRESETS, presetRange, readDatePreset } from '@/lib/list-filters'
import { formatMoney } from '@/lib/money'
import { BillHome } from '@/components/purchases/bill-home'
import { PurchaseDocumentRegister } from '@/components/purchases/purchase-document-register'
import { VendorCreditHome } from '@/components/purchases/vendor-credit-home'
import { purchaseBySlug } from '@/lib/purchase-types'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { trailsFor } from '@/server/services/audit.service'
import * as purchaseService from '@/server/services/purchase.service'
import { ExpenseScreen } from '../expense-screen'
import { PurchaseOrderScreen } from '../purchase-order-screen'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  return { title: purchaseBySlug((await params).type)?.plural ?? 'Purchases' }
}

const BILL_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'notdue', label: 'Not due yet' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Drafts' },
]

const VENDOR_CREDIT_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Applied' },
  { value: 'draft', label: 'Drafts' },
]

const SORTABLE = ['number', 'date', 'vendor', 'reference', 'dueDate', 'total', 'status'] as const

export default async function PurchaseListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const config = purchaseBySlug((await params).type)
  if (!config) notFound()

  const search = await searchParams
  if (config.type === 'PURCHASE_ORDER') return <PurchaseOrderScreen search={search} />
  if (config.type === 'EXPENSE') return <ExpenseScreen search={search} />

  const ctx = await requireOrgContext('bill:read')
  const query = parseListQuery(search)
  const statusOptions =
    config.type === 'BILL' ? BILL_FILTERS : config.type === 'VENDOR_CREDIT' ? VENDOR_CREDIT_FILTERS : null
  const statusRaw = typeof search.status === 'string' ? search.status : ''
  const status = statusOptions?.some((option) => option.value === statusRaw) ? statusRaw : undefined
  const vendorId = typeof search.vendorId === 'string' ? search.vendorId : undefined
  const datePreset = readDatePreset(search.date)
  const range = presetRange(datePreset, today(ctx.organization.timeZone))
  const sort = readSort(search, SORTABLE, { sort: 'date', dir: 'desc' })

  const [page, billHome, creditHome, vendorRows] = await Promise.all([
    purchaseService.list(ctx, config.type, query, {
      status,
      vendorId,
      ...sort,
      from: range?.from,
      to: range?.to,
    }),
    config.type === 'BILL' ? purchaseService.billHome(ctx) : Promise.resolve(null),
    config.type === 'VENDOR_CREDIT' ? purchaseService.vendorCreditHome(ctx) : Promise.resolve(null),
    purchaseService.vendorChoices(ctx),
  ])
  const trails = await trailsFor(ctx, page.rows.map((row) => row.id))
  const basePath = `/purchases/${config.slug}`
  const canEditDocuments = ctx.permissions.has('bill:update')
  const canDelete = ctx.features.allowDocumentDelete && ctx.permissions.has('bill:void')
  const canCreate = ctx.permissions.has('bill:create')
  const linkParams = {
    q: query.q,
    status: status || undefined,
    vendorId: vendorId || undefined,
    date: datePreset || undefined,
    sort: sort.sort,
    dir: sort.dir,
  }
  const currency = ctx.organization.baseCurrency
  const now = today(ctx.organization.timeZone)
  const clock = overdueClock(ctx.organization.timeZone)

  const newButton = canCreate ? (
    <Link href={`/purchases/${config.slug}/new`} className={buttonVariants({ size: 'sm' })}>
      <PlusIcon /> New {config.singular.toLowerCase()}
    </Link>
  ) : undefined

  return (
    <>
      {billHome ? (
        <BillHome
          currency={currency}
          canCreate={canCreate}
          active={status ?? ''}
          params={linkParams}
          home={billHome}
        />
      ) : creditHome ? (
        <VendorCreditHome
          currency={currency}
          canCreate={canCreate}
          active={status ?? ''}
          params={linkParams}
          home={creditHome}
        />
      ) : (
        <PageHeader title={config.plural} description={config.effect} actions={newButton} />
      )}

      <PurchaseDocumentRegister
        vendors={vendorRows.map((vendor) => ({ value: vendor.id, label: vendor.displayName }))}
        basePath={basePath}
        params={linkParams}
        sort={sort}
        statusOptions={statusOptions ?? []}
        dateOptions={[...DATE_PRESETS.map((preset) => ({ value: preset.value || 'all', label: preset.label }))]}
        status={status ?? ''}
        date={datePreset || 'all'}
        canCreate={canCreate}
        singular={config.singular}
        plural={config.plural}
        exportSlug={config.slug}
        showBalance={config.type === 'BILL'}
        showDue={config.type === 'BILL'}
        rows={page.rows.map((row) => {
          const overdue = isCollectionOverdue(
            {
              status: row.status,
              dueDate: row.dueDate ? toCalendarDate(row.dueDate) : null,
              date: toCalendarDate(row.date),
              ...partyFromContact(row.vendor),
            },
            now,
            clock,
          )
          return {
            id: row.id,
            number: row.number,
            date: formatTransactionDate(toCalendarDate(row.date), row.createdAt, ctx.organization.timeZone),
            vendor: row.vendor?.displayName ?? '—',
            reference: row.reference,
            due: row.dueDate ? formatDate(toCalendarDate(row.dueDate)) : null,
            overdue,
            amount: formatMoney(row.total, currency),
            balance:
              config.type === 'BILL'
                ? Number(row.balance) === 0
                  ? '—'
                  : formatMoney(row.balance, currency)
                : null,
            status: row.status,
            href: `${basePath}/${row.id}`,
            editHref: canEditDocuments && row.status !== 'VOID' ? `${basePath}/${row.id}/edit` : null,
            printHref: `${basePath}/${row.id}/print`,
            canDelete,
            trail: trails.get(row.id),
          }
        })}
      />
    </>
  )
}
