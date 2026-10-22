import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PlusIcon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { readSort } from '@/components/data/sortable-header'
import { buttonVariants } from '@/components/ui/button'
import { formatTransactionDate, toCalendarDate, toDate, today } from '@/lib/date'
import { isCollectionOverdue, overdueClock, partyFromContact } from '@/lib/invoice-overdue'
import { isDatePreset, presetRange, readDatePreset } from '@/lib/list-filters'
import { formatMoney } from '@/lib/money'
import { EstimateHome } from '@/components/sales/estimate-home'
import { EstimateRegister } from '@/components/sales/estimate-register'
import { InvoiceHome } from '@/components/sales/invoice-home'
import { InvoiceRegister } from '@/components/sales/invoice-register'
import { ReceiptHome } from '@/components/sales/receipt-home'
import { ReceiptRegister } from '@/components/sales/receipt-register'
import { SalesOrderHome } from '@/components/sales/sales-order-home'
import { SalesOrderRegister } from '@/components/sales/sales-order-register'
import { SalesSheetRegister } from '@/components/sales/sales-sheet-register'
import { bySlug, isProposal, isSalesOrder, STATUS_LABELS } from '@/lib/sales-types'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { trailsFor } from '@/server/services/audit.service'
import { loadDepositAccounts } from '@/server/services/sales-options'
import * as salesService from '@/server/services/sales.service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  const config = bySlug((await params).type)
  return { title: config?.plural ?? 'Sales' }
}

const SORTABLE = ['number', 'date', 'customer', 'dueDate', 'total', 'status'] as const

const INVOICE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'notdue', label: 'Not due yet' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Drafts' },
]

const INVOICE_DATES = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: 'last3', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
]

const RECEIPT_FILTERS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
]

const ESTIMATE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'draft', label: 'Drafts' },
]

const SALES_ORDER_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'draft', label: 'Drafts' },
]

const ESTIMATE_DATES = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: 'last3', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
]

export default async function SalesListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const config = bySlug((await params).type)
  if (!config) notFound()

  const ctx = await requireOrgContext('invoice:read')
  const search = await searchParams
  const query = parseListQuery(search)
  const statusOptions =
    config.type === 'INVOICE'
      ? INVOICE_FILTERS
      : config.type === 'SALES_RECEIPT'
        ? RECEIPT_FILTERS
        : isProposal(config.type)
          ? ESTIMATE_FILTERS
          : isSalesOrder(config.type)
            ? SALES_ORDER_FILTERS
            : null
  const statusRaw = typeof search.status === 'string' ? search.status : ''
  const status = statusOptions?.some((option) => option.value === statusRaw) ? statusRaw : undefined
  const customerId = typeof search.customer === 'string' && search.customer ? search.customer : undefined
  const rawDate = typeof search.date === 'string' ? search.date : undefined
  const dashboard =
    config.type === 'INVOICE' ||
    config.type === 'SALES_RECEIPT' ||
    isProposal(config.type) ||
    isSalesOrder(config.type)
  // Invoices, sales receipts, estimates, quotations, and sales orders open on the
  // last three months. "All dates" is an explicit choice.
  const datePreset = dashboard
    ? rawDate === 'all'
      ? ''
      : rawDate && isDatePreset(rawDate) && rawDate !== ''
        ? rawDate
        : 'last3'
    : readDatePreset(search.date)
  const range = presetRange(datePreset, today(ctx.organization.timeZone))
  const sort = readSort(search, SORTABLE, { sort: 'date', dir: 'desc' })

  const [page, receiptHome, invoiceHome, estimateHome, orderHome, choices, depositAccounts] =
    await Promise.all([
      salesService.list(ctx, config.type, query, {
        status,
        customerId,
        ...sort,
        from: range?.from,
        to: range?.to,
      }),
      config.type === 'SALES_RECEIPT' ? salesService.receiptHome(ctx) : Promise.resolve(null),
      config.type === 'INVOICE' ? salesService.invoiceHome(ctx) : Promise.resolve(null),
      isProposal(config.type)
        ? salesService.estimateHome(ctx, config.type as 'ESTIMATE' | 'QUOTATION')
        : Promise.resolve(null),
      isSalesOrder(config.type) ? salesService.salesOrderHome(ctx) : Promise.resolve(null),
      salesService.customerChoices(ctx),
      (isSalesOrder(config.type) || isProposal(config.type)) &&
      ctx.permissions.has('invoice:create')
        ? loadDepositAccounts(ctx)
        : Promise.resolve([]),
    ])
  const trails = await trailsFor(ctx, page.rows.map((row) => row.id))
  const currency = ctx.organization.baseCurrency
  const timeZone = ctx.organization.timeZone
  const now = today(timeZone)
  const clock = overdueClock(timeZone)

  const basePath = `/sales/${config.slug}`
  const customers = choices.map((customer) => ({ value: customer.id, label: customer.displayName }))
  const linkParams = {
    q: query.q,
    status: status || undefined,
    customer: customerId,
    date: dashboard ? datePreset || 'all' : datePreset || undefined,
    sort: sort.sort,
    dir: sort.dir,
  }

  const canCreate = ctx.permissions.has(config.createPermission)
  const canCreateInvoice = ctx.permissions.has('invoice:create')
  const canEditDocuments = ctx.permissions.has('invoice:update')
  const canDelete = ctx.features.allowDocumentDelete && ctx.permissions.has('invoice:void')
  const convertToday = today(ctx.organization.timeZone)
  const newButton = canCreate ? (
    <Link href={`/sales/${config.slug}/new`} className={buttonVariants({ size: 'sm' })}>
      <PlusIcon /> New {config.singular.toLowerCase()}
    </Link>
  ) : undefined

  return (
    <>
      {receiptHome ? (
        <ReceiptHome
          currency={currency}
          canCreate={canCreate}
          active={datePreset || 'all'}
          params={linkParams}
          home={receiptHome}
        />
      ) : invoiceHome ? (
        <InvoiceHome
          currency={currency}
          canCreate={canCreate}
          active={status ?? ''}
          params={linkParams}
          home={invoiceHome}
        />
      ) : estimateHome ? (
        <EstimateHome
          currency={currency}
          canCreate={canCreate}
          active={status ?? ''}
          params={linkParams}
          home={estimateHome}
          basePath={basePath}
          singular={config.singular}
          plural={config.plural}
        />
      ) : orderHome ? (
        <SalesOrderHome
          currency={currency}
          canCreate={canCreate}
          active={status ?? ''}
          params={linkParams}
          home={orderHome}
        />
      ) : (
        <PageHeader title={config.plural} description={config.effect} actions={newButton} />
      )}

      {invoiceHome ? (
        <InvoiceRegister
          customers={customers}
          rows={page.rows.map((row) => {
            const due = row.dueDate ? toCalendarDate(row.dueDate) : null
            const promisedDate = row.promisedDate ? toCalendarDate(row.promisedDate) : null
            const open = row.status === 'OPEN' || row.status === 'PARTIAL'
            const party = partyFromContact(row.customer)
            const overdue = isCollectionOverdue(
              {
                status: row.status,
                dueDate: due,
                promisedDate,
                excludeFromOverdue: row.excludeFromOverdue,
                date: toCalendarDate(row.date),
                ...party,
              },
              now,
              clock,
            )
            const collectionDue = promisedDate ?? party.partyBalanceDate ?? party.partyAgreementDate ?? due
            const days =
              overdue && collectionDue
                ? Math.round((toDate(now).getTime() - toDate(collectionDue).getTime()) / 86_400_000)
                : 0
            const trail = trails.get(row.id)
            const later = trail?.changed && trail.changed.name !== trail.entered?.name
            return {
              id: row.id,
              number: row.number,
              date: formatTransactionDate(toCalendarDate(row.date), row.createdAt, timeZone),
              due,
              promisedDate,
              excludeFromOverdue: row.excludeFromOverdue,
              customer: row.customer.displayName,
              amount: formatMoney(row.total, currency),
              balance: formatMoney(row.balance, currency),
              statusText: overdue
                ? days > 0
                  ? `Overdue ${days} ${days === 1 ? 'day' : 'days'}`
                  : 'Overdue'
                : (STATUS_LABELS[row.status] ?? row.status),
              overdue,
              href: `${basePath}/${row.id}`,
              editHref: canEditDocuments && row.status !== 'VOID' ? `${basePath}/${row.id}/edit` : null,
              printHref: `${basePath}/${row.id}/print`,
              payHref:
                ctx.permissions.has('payment:create') && open ? `/payments/new?customer=${row.customer.id}` : null,
              recorded: trail?.entered ? (later ? `${trail.entered.name} · ${trail.changed?.name}` : trail.entered.name) : null,
              canDelete,
              canEditCollections: canEditDocuments && open,
            }
          })}
          basePath={basePath}
          params={linkParams}
          sort={sort}
          statusOptions={INVOICE_FILTERS}
          dateOptions={INVOICE_DATES}
          status={status ?? ''}
          date={datePreset || 'all'}
          canCreate={canCreate}
          canPay={ctx.permissions.has('payment:create')}
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          pageSize={page.pageSize}
        />
      ) : null}

      {receiptHome ? (
        <ReceiptRegister
          customers={customers}
          rows={page.rows.map((row) => {
            const trail = trails.get(row.id)
            const later = trail?.changed && trail.changed.name !== trail.entered?.name
            const account = row.depositAccount
            return {
              id: row.id,
              number: row.number,
              date: formatTransactionDate(toCalendarDate(row.date), row.createdAt, timeZone),
              customer: row.customer.displayName,
              amount: formatMoney(row.total, currency),
              deposit: account ? `${account.code} ${account.name}` : '—',
              statusText:
                row.status === 'OPEN' || row.status === 'PAID' ? 'Paid' : (STATUS_LABELS[row.status] ?? row.status),
              href: `${basePath}/${row.id}`,
              editHref: canEditDocuments && row.status !== 'VOID' ? `${basePath}/${row.id}/edit` : null,
              printHref: `${basePath}/${row.id}/print`,
              recorded: trail?.entered ? (later ? `${trail.entered.name} · ${trail.changed?.name}` : trail.entered.name) : null,
              canDelete,
            }
          })}
          basePath={basePath}
          params={linkParams}
          sort={sort}
          statusOptions={RECEIPT_FILTERS}
          dateOptions={INVOICE_DATES}
          status={status ?? ''}
          date={datePreset || 'all'}
          canCreate={canCreate}
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          pageSize={page.pageSize}
        />
      ) : null}

      {estimateHome ? (
        <EstimateRegister
          customers={customers}
          rows={page.rows.map((row) => {
            const trail = trails.get(row.id)
            const later = trail?.changed && trail.changed.name !== trail.entered?.name
            const canConvert =
              canCreateInvoice &&
              !row.convertedTo &&
              row.status !== 'VOID' &&
              row.status !== 'DECLINED' &&
              row.status !== 'CLOSED'
            return {
              id: row.id,
              number: row.number,
              date: formatTransactionDate(toCalendarDate(row.date), row.createdAt, timeZone),
              customer: row.customer.displayName,
              amount: formatMoney(row.total, currency),
              statusText:
                row.status === 'CLOSED' ? 'Invoiced' : (STATUS_LABELS[row.status] ?? row.status),
              href: `${basePath}/${row.id}`,
              editHref: canEditDocuments && row.status !== 'VOID' ? `${basePath}/${row.id}/edit` : null,
              printHref: `${basePath}/${row.id}/print`,
              recorded: trail?.entered
                ? later
                  ? `${trail.entered.name} · ${trail.changed?.name}`
                  : trail.entered.name
                : null,
              canDelete,
              canConvert,
            }
          })}
          basePath={basePath}
          params={linkParams}
          sort={sort}
          statusOptions={ESTIMATE_FILTERS}
          dateOptions={ESTIMATE_DATES}
          status={status ?? ''}
          date={datePreset || 'all'}
          canCreate={canCreate}
          convertToday={convertToday}
          depositAccounts={depositAccounts}
          sourceType={config.type as 'ESTIMATE' | 'QUOTATION'}
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          pageSize={page.pageSize}
          singular={config.singular}
          plural={config.plural}
          exportSlug={config.slug}
        />
      ) : null}

      {orderHome ? (
        <SalesOrderRegister
          customers={customers}
          rows={page.rows.map((row) => {
            const trail = trails.get(row.id)
            const later = trail?.changed && trail.changed.name !== trail.entered?.name
            const canFulfill =
              canCreateInvoice &&
              !row.convertedTo &&
              row.status !== 'VOID' &&
              row.status !== 'CLOSED'
            const statusText =
              row.status === 'CLOSED'
                ? row.convertedTo?.type === 'SALES_RECEIPT'
                  ? 'Receipt'
                  : 'Invoiced'
                : (STATUS_LABELS[row.status] ?? row.status)
            return {
              id: row.id,
              number: row.number,
              date: formatTransactionDate(toCalendarDate(row.date), row.createdAt, timeZone),
              customer: row.customer.displayName,
              amount: formatMoney(row.total, currency),
              statusText,
              href: `${basePath}/${row.id}`,
              editHref:
                canEditDocuments && row.status !== 'VOID' && row.status !== 'CLOSED'
                  ? `${basePath}/${row.id}/edit`
                  : null,
              printHref: `${basePath}/${row.id}/print`,
              recorded: trail?.entered
                ? later
                  ? `${trail.entered.name} · ${trail.changed?.name}`
                  : trail.entered.name
                : null,
              canDelete,
              canFulfill,
            }
          })}
          params={linkParams}
          sort={sort}
          statusOptions={SALES_ORDER_FILTERS}
          dateOptions={ESTIMATE_DATES}
          status={status ?? ''}
          date={datePreset || 'all'}
          canCreate={canCreate}
          convertToday={convertToday}
          depositAccounts={depositAccounts}
          total={page.total}
        />
      ) : null}

      {invoiceHome || receiptHome || estimateHome || orderHome ? null : (
        <SalesSheetRegister
          customers={customers}
          basePath={basePath}
          params={linkParams}
          sort={sort}
          canCreate={canCreate}
          singular={config.singular}
          plural={config.plural}
          exportSlug={config.slug}
          rows={page.rows.map((row) => ({
            id: row.id,
            number: row.number,
            date: formatTransactionDate(toCalendarDate(row.date), row.createdAt, timeZone),
            customer: row.customer.displayName,
            amount: formatMoney(row.total, currency),
            status: row.status,
            href: `${basePath}/${row.id}`,
            editHref: canEditDocuments && row.status !== 'VOID' ? `${basePath}/${row.id}/edit` : null,
            printHref: `${basePath}/${row.id}/print`,
            canDelete,
            trail: trails.get(row.id),
          }))}
        />
      )}
    </>
  )
}
