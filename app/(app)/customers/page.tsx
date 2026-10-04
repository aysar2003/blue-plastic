import type { Metadata } from 'next'

import { CustomerActions } from '@/components/customers/customer-actions'
import { CustomerPapers } from '@/components/customers/customer-papers'
import {
  ContactCenter,
  isActivitySort,
  isPeopleSort,
  readCenterRowMode,
  sortCenterRows,
  type CenterTab,
} from '@/components/contacts/contact-center'
import { ImportDialog } from '@/components/master-data/import-dialog'
import { NewContactButton } from '@/components/master-data/contact-dialog'
import { readSort } from '@/components/data/sortable-header'
import { describeTerm } from '@/lib/payment-terms'
import { today } from '@/lib/date'
import { presetRange, readDatePreset } from '@/lib/list-filters'
import { letterheadLines } from '@/lib/letterhead'
import { formatMoney } from '@/lib/money'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as contactService from '@/server/services/contact.service'
import { customerActivity, customerMoneyBar, isBandKey } from '@/server/services/customer-dashboard'
import * as taxService from '@/server/services/tax.service'
import { IMPORT_COLUMNS } from '@/server/services/import.service'

export const metadata: Metadata = { title: 'Customers' }

const SORTABLE = ['name', 'company', 'phone', 'balance'] as const
const TABS = ['transactions', 'contacts', 'tasks', 'notes', 'mail'] as const

function listed(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part))
}

function isTab(value: string | undefined): value is CenterTab {
  return TABS.some((tab) => tab === value)
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('customer:read')
  const params = await searchParams
  const query = parseListQuery(params)
  const sort = readSort(params, SORTABLE, { sort: 'name', dir: 'asc' })
  const includeInactive = params.archived === '1'
  const bandValue = typeof params.band === 'string' ? params.band : undefined
  const band = isBandKey(bandValue) ? bandValue : undefined
  const requestedId = typeof params.id === 'string' ? params.id : undefined
  const tabValue = typeof params.tab === 'string' ? params.tab : undefined
  const tab: CenterTab = isTab(tabValue) ? tabValue : 'transactions'
  const asOf = today(ctx.organization.timeZone)

  const tx = typeof params.tx === 'string' ? params.tx : ''
  const txSortParam = typeof params.txSort === 'string' ? params.txSort : undefined
  const txSort = isActivitySort(txSortParam) ? txSortParam : ''
  const txDir = params.txDir === 'desc' ? 'desc' : 'asc'
  const rowMode = readCenterRowMode(params.rows)
  const datePreset = readDatePreset(params.date)
  const range = presetRange(datePreset, asOf)

  const bar = band ? await customerMoneyBar(ctx, asOf) : null
  const bandIds = bar && band ? bar[band].customerIds : undefined

  const [page, terms] = await Promise.all([
    bandIds && bandIds.length === 0
      ? Promise.resolve({ rows: [], total: 0, page: 1, pageCount: 1, pageSize: query.pageSize })
      : contactService.listCustomers(ctx, query, { includeInactive, sort: sort.sort, dir: sort.dir, ids: bandIds }),
    taxService.listPaymentTerms(ctx),
  ])

  const [customer, activity] = requestedId
    ? await Promise.all([
        contactService.getCustomer(ctx, requestedId).catch(() => null),
        customerActivity(ctx, requestedId),
      ])
    : [null, []]

  const canCreate = ctx.permissions.has('customer:create')
  const canInvoice = ctx.permissions.has('invoice:create')
  const canPay = ctx.permissions.has('payment:create')
  const canReport = ctx.permissions.has('report:read')
  const canEdit = ctx.permissions.has('customer:update')
  const canArchive = ctx.permissions.has('customer:archive')
  const termOptions = terms.map((term) => ({ id: term.id, label: `${term.name} — ${describeTerm(term)}` }))
  const currency = ctx.organization.baseCurrency

  const customerHref = (id: string) => {
    const next = new URLSearchParams()
    if (query.q) next.set('q', query.q)
    if (includeInactive) next.set('archived', '1')
    if (band) next.set('band', band)
    if (sort.sort !== 'name') next.set('sort', sort.sort)
    if (sort.dir !== 'asc') next.set('dir', sort.dir)
    if (datePreset) next.set('date', datePreset)
    if (tx) next.set('tx', tx)
    if (txSort) next.set('txSort', txSort)
    if (txSort) next.set('txDir', txDir)
    if (rowMode !== 'split') next.set('rows', rowMode)
    if (tab !== 'transactions') next.set('tab', tab)
    next.set('id', id)
    return `/customers?${next.toString()}`
  }

  const archivedQuery = new URLSearchParams()
  if (query.q) archivedQuery.set('q', query.q)
  if (band) archivedQuery.set('band', band)
  if (datePreset) archivedQuery.set('date', datePreset)
  if (tx) archivedQuery.set('tx', tx)
  if (txSort) archivedQuery.set('txSort', txSort)
  if (txSort) archivedQuery.set('txDir', txDir)
  if (rowMode !== 'split') archivedQuery.set('rows', rowMode)
  if (customer?.id) archivedQuery.set('id', customer.id)
  if (!includeInactive) archivedQuery.set('archived', '1')
  const archivedHref = archivedQuery.size > 0 ? `/customers?${archivedQuery.toString()}` : '/customers'

  const billTo = customer
    ? listed([
        customer.billingLine1,
        customer.billingLine2,
        listed([customer.billingCity, customer.billingRegion, customer.billingPostalCode]).join(', '),
        customer.billingCountry,
      ])
    : []

  const kinds = [...new Set(activity.map((row) => row.kind))]
  const shown = sortCenterRows(
    activity.filter((row) => {
      if (tx && row.kind !== tx) return false
      if (range && (row.date < range.from || row.date > range.to)) return false
      return true
    }),
    txSort,
    txDir,
  )
  const filterParams = {
    q: query.q,
    archived: includeInactive ? '1' : undefined,
    band,
    id: customer?.id,
    date: datePreset || undefined,
    tx: tx || undefined,
    tab: tab === 'transactions' ? undefined : tab,
    txSort: txSort || undefined,
    txDir: txSort ? txDir : undefined,
    rows: rowMode === 'split' ? undefined : rowMode,
    sort: sort.sort !== 'name' ? sort.sort : undefined,
    dir: sort.dir !== 'asc' ? sort.dir : undefined,
  }

  const tabHref = (nextTab: CenterTab) => {
    const next = new URLSearchParams()
    if (query.q) next.set('q', query.q)
    if (includeInactive) next.set('archived', '1')
    if (band) next.set('band', band)
    if (datePreset) next.set('date', datePreset)
    if (tx) next.set('tx', tx)
    if (txSort) next.set('txSort', txSort)
    if (txSort) next.set('txDir', txDir)
    if (rowMode !== 'split') next.set('rows', rowMode)
    if (customer?.id) next.set('id', customer.id)
    if (nextTab !== 'transactions') next.set('tab', nextTab)
    const text = next.toString()
    return text ? `/customers?${text}` : '/customers'
  }

  const exportHref = `/api/exports/customers?${new URLSearchParams(
    Object.entries({
      q: query.q,
      archived: includeInactive ? '1' : undefined,
      sort: sort.sort,
      dir: sort.dir,
    }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString()}`

  const id = customer ? encodeURIComponent(customer.id) : ''
  const transactions = customer
    ? [
        ...(canInvoice
          ? [
              { label: 'Invoice', href: `/sales/invoices/new?customer=${id}` },
              { label: 'Quotation', href: `/sales/estimates/new?customer=${id}` },
              { label: 'Sales receipt', href: `/sales/sales-receipts/new?customer=${id}` },
              { label: 'Credit memo', href: `/sales/credit-memos/new?customer=${id}` },
              { label: 'Refund', href: `/sales/refunds/new?customer=${id}` },
            ]
          : []),
        ...(canPay ? [{ label: 'Receive payment', href: `/payments/new?customer=${id}` }] : []),
      ]
    : []

  const reports = customer && canReport
    ? [
        { label: 'QuickReport', href: `/reports/statements/customer?customerId=${id}&view=detail&period=all-dates` },
        { label: 'Open balance', href: `/reports/statements/customer?customerId=${id}&status=open&period=all-dates` },
        { label: 'Show estimates', href: withTx(customerHref(customer.id), 'Quotation') },
        { label: 'Customer snapshot', href: `/reports/statements/customer?customerId=${id}&period=all-dates` },
      ]
    : []

  const fullName = customer
    ? listed([customer.firstName, customer.lastName]).join(' ') || customer.displayName
    : ''

  const companyLines = letterheadLines(ctx.organization).map((line) => [line])
  const wordRows = customer
    ? [
        ...companyLines,
        [],
        ['Company', customer.companyName ?? customer.displayName],
        ['Full name', fullName],
        ['Bill to', billTo.join(', ')],
        ['Main phone', customer.phone ?? ''],
        ['Work phone', customer.mobile ?? ''],
        ['Open balance', formatMoney(customer.balance, currency)],
        ['Agreement date', customer.agreementDate ?? ''],
        ['Balance date', customer.balanceDate ?? ''],
        ['Balance time', customer.balanceTime ?? ''],
        ['Reminder', customer.reminderDays ? `${customer.reminderDays} days before` : ''],
        [],
        ['Type', 'Num', 'Date', 'Account', 'Amount'],
        ...shown.map((row) => [row.kind, row.number, row.date, row.account ?? '', formatMoney(row.amount, currency)]),
      ]
    : [...companyLines, [], ['Name', 'Balance'], ...page.rows.map((row) => [row.displayName, formatMoney(row.balance, currency)])]

  return (
    <ContactCenter
      title="Customer information"
      people={page.rows.map((row) => ({
        id: row.id,
        name: row.displayName,
        balance: row.balance,
        active: row.isActive,
      }))}
      selectedId={customer?.id}
      personHref={customerHref}
      profile={
        customer
          ? {
              company: customer.companyName ?? customer.displayName,
              fullName,
              billTo,
              phone: customer.phone,
              workPhone: customer.mobile,
              email: customer.email,
              notes: customer.notes,
              balance: customer.balance,
            }
          : null
      }
      rows={shown}
      currency={currency}
      tab={tab}
      tabHref={tabHref}
      kinds={kinds.map((kind) => ({ value: kind, label: kind }))}
      activeKind={kinds.includes(tx) ? tx : ''}
        datePreset={datePreset}
        rowMode={rowMode}
        filterPath="/customers"
      filterParams={filterParams}
      activitySort={txSort ? { sort: txSort, dir: txDir } : undefined}
      peopleSort={
        isPeopleSort(sort.sort) ? { sort: sort.sort, dir: sort.dir } : undefined
      }
      newContact={
        <>
          {canCreate ? <ImportDialog kind="customer" columns={IMPORT_COLUMNS} /> : null}
          {canCreate ? (
            <NewContactButton
              side="customer"
              terms={termOptions}
              today={asOf}
              currency={currency}
              className="bg-[#2ca01c] text-white hover:bg-[#248a18]"
            />
          ) : null}
        </>
      }
      headerExtra={
        customer ? (
          <CustomerActions
            customerId={customer.id}
            contact={customer}
            terms={termOptions}
            today={asOf}
            currency={currency}
            canInvoice={false}
            canPay={false}
            canReport={false}
            canEdit={canEdit}
            canArchive={canArchive}
            isActive={customer.isActive}
          />
        ) : null
      }
      archivedHref={archivedHref}
      archivedLabel={includeInactive ? 'Hide archived' : 'Archived'}
      transactions={transactions}
      reports={reports}
      excelHref={exportHref}
      wordTitle={customer ? customer.displayName : 'Customers'}
      wordRows={wordRows}
      chooseLabel="Choose a customer on the left. Their details and transactions show here."
      profileExtra={
        customer ? (
          <CustomerPapers
            customerId={customer.id}
            agreementDate={customer.agreementDate}
            balanceDate={customer.balanceDate}
            balanceTime={customer.balanceTime}
            reminderDays={customer.reminderDays}
            files={customer.files}
            canEdit={canEdit}
          />
        ) : null
      }
    />
  )
}

function withTx(href: string, kind: string) {
  const url = new URL(href, 'http://local')
  url.searchParams.set('tx', kind)
  return `${url.pathname}?${url.searchParams.toString()}`
}
