import type { Metadata } from 'next'

import {
  ContactCenter,
  isActivitySort,
  isPeopleSort,
  readCenterRowMode,
  sortCenterRows,
  type CenterTab,
} from '@/components/contacts/contact-center'
import { ContactMoneyBar } from '@/components/contacts/contact-money-bar'
import { ImportDialog } from '@/components/master-data/import-dialog'
import { NewContactButton } from '@/components/master-data/contact-dialog'
import { VendorActions } from '@/components/vendors/vendor-actions'
import { readSort } from '@/components/data/sortable-header'
import { accountOptions } from '@/lib/account-options'
import { today } from '@/lib/date'
import { presetRange, readDatePreset } from '@/lib/list-filters'
import { letterheadLines } from '@/lib/letterhead'
import { formatMoney } from '@/lib/money'
import { describeTerm } from '@/lib/payment-terms'
import { vendorBandDetail } from '@/lib/vendor-bands'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import * as contactService from '@/server/services/contact.service'
import * as taxService from '@/server/services/tax.service'
import { vendorActivity } from '@/server/services/vendor-activity'
import { isVendorBandKey, vendorMoneyBar } from '@/server/services/vendor-dashboard'
import { VENDOR_COLUMNS } from '@/server/services/import.service'

export const metadata: Metadata = { title: 'Vendors' }

const SORTABLE = ['name', 'email', 'phone', 'company', 'balance'] as const
const TABS = ['transactions', 'contacts', 'tasks', 'notes', 'mail'] as const

function listed(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part))
}

function isTab(value: string | undefined): value is CenterTab {
  return TABS.some((tab) => tab === value)
}

function withTx(href: string, kind: string) {
  const url = new URL(href, 'http://local')
  url.searchParams.set('tx', kind)
  return `${url.pathname}?${url.searchParams.toString()}`
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('vendor:read')
  const params = await searchParams
  const query = parseListQuery(params)
  const sort = readSort(params, SORTABLE, { sort: 'name', dir: 'asc' })
  const includeInactive = params.archived === '1'
  const bandValue = typeof params.band === 'string' ? params.band : undefined
  const band = isVendorBandKey(bandValue) ? bandValue : undefined
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

    // Vendor money bar, payment terms, and expense accounts are independent.
  // Without a band filter the vendor list joins that same round-trip.
  const termsPromise = taxService.listPaymentTerms(ctx)
  const accountsPromise = accountService.selectableAccounts(ctx)
  const barPromise = vendorMoneyBar(ctx, asOf)

  let bar: Awaited<ReturnType<typeof vendorMoneyBar>>
  let page: Awaited<ReturnType<typeof contactService.listVendors>>
  let terms: Awaited<ReturnType<typeof taxService.listPaymentTerms>>
  let accounts: Awaited<ReturnType<typeof accountService.selectableAccounts>>

  if (!band) {
    ;[bar, page, terms, accounts] = await Promise.all([
      barPromise,
      contactService.listVendors(ctx, query, { includeInactive, ...sort }),
      termsPromise,
      accountsPromise,
    ])
  } else {
    ;[bar, terms, accounts] = await Promise.all([barPromise, termsPromise, accountsPromise])
    const bandIds = bar[band].vendorIds
    page =
      bandIds.length === 0
        ? { rows: [], total: 0, page: 1, pageCount: 1, pageSize: query.pageSize }
        : await contactService.listVendors(ctx, query, { includeInactive, ...sort, ids: bandIds })
  }

  const [vendor, activity] = requestedId
    ? await Promise.all([
        contactService.getVendor(ctx, requestedId).catch(() => null),
        vendorActivity(ctx, requestedId),
      ])
    : [null, []]

  const canCreate = ctx.permissions.has('vendor:create')
  const canBill = ctx.permissions.has('bill:create')
  const canPay = ctx.permissions.has('expense:create')
  const canReport = ctx.permissions.has('report:read')
  const canEdit = ctx.permissions.has('vendor:update')
  const canArchive = ctx.permissions.has('vendor:archive')
  const termOptions = terms.map((term) => ({ id: term.id, label: `${term.name} — ${describeTerm(term)}` }))
  const expenseOptions = accountOptions(accounts, {
    prefer: ['OPERATING_EXPENSE', 'COST_OF_GOODS_SOLD', 'OTHER_EXPENSE'],
    preferTypes: ['EXPENSE'],
  })
  const currency = ctx.organization.baseCurrency

  const vendorHref = (id: string) => {
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
    return `/vendors?${next.toString()}`
  }

  const archivedQuery = new URLSearchParams()
  if (query.q) archivedQuery.set('q', query.q)
  if (band) archivedQuery.set('band', band)
  if (datePreset) archivedQuery.set('date', datePreset)
  if (tx) archivedQuery.set('tx', tx)
  if (txSort) archivedQuery.set('txSort', txSort)
  if (txSort) archivedQuery.set('txDir', txDir)
  if (rowMode !== 'split') archivedQuery.set('rows', rowMode)
  if (vendor?.id) archivedQuery.set('id', vendor.id)
  if (!includeInactive) archivedQuery.set('archived', '1')
  const archivedHref = archivedQuery.size > 0 ? `/vendors?${archivedQuery.toString()}` : '/vendors'

  const billTo = vendor
    ? listed([
        vendor.billingLine1,
        vendor.billingLine2,
        listed([vendor.billingCity, vendor.billingRegion, vendor.billingPostalCode]).join(', '),
        vendor.billingCountry,
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
    id: vendor?.id,
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
    if (vendor?.id) next.set('id', vendor.id)
    if (nextTab !== 'transactions') next.set('tab', nextTab)
    const text = next.toString()
    return text ? `/vendors?${text}` : '/vendors'
  }

  const exportHref = `/api/exports/vendors?${new URLSearchParams(
    Object.entries({
      q: query.q,
      archived: includeInactive ? '1' : undefined,
      sort: sort.sort,
      dir: sort.dir,
    }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString()}`

  const id = vendor ? encodeURIComponent(vendor.id) : ''
  const transactions = vendor
    ? [
        ...(canBill
          ? [
              { label: 'Bill', href: `/purchases/bills/new?vendor=${id}` },
              { label: 'Expense', href: `/purchases/expenses/new?vendor=${id}` },
              { label: 'Vendor credit', href: `/purchases/vendor-credits/new?vendor=${id}` },
              { label: 'Purchase order', href: `/purchases/purchase-orders/new?vendor=${id}` },
              {
                label: 'Receive items',
                href: `/purchases/purchase-orders?status=open&vendorId=${id}`,
              },
              {
                label: 'Delivery',
                href: `/purchases/delivery/outstanding?vendorId=${id}`,
              },
            ]
          : []),
        ...(canPay ? [{ label: 'Pay bill', href: `/bill-payments/new?vendor=${id}` }] : []),
        { label: 'Item list', href: '/items' },
      ]
    : []

  const reports = vendor && canReport
    ? [
        { label: 'QuickReport', href: `/reports/statements/vendor?vendorId=${id}&period=all-dates` },
        { label: 'Open balance', href: `/reports/statements/vendor?vendorId=${id}&period=all-dates` },
        { label: 'Show purchase orders', href: withTx(vendorHref(vendor.id), 'Purchase order') },
        { label: 'Vendor snapshot', href: `/reports/statements/vendor?vendorId=${id}&period=all-dates` },
        { label: 'Purchases by item', href: `/reports/purchases-by-item` },
      ]
    : []

  const fullName = vendor ? listed([vendor.firstName, vendor.lastName]).join(' ') || vendor.displayName : ''

  const companyLines = letterheadLines(ctx.organization).map((line) => [line])
  const wordRows = vendor
    ? [
        ...companyLines,
        [],
        ['Company', vendor.companyName ?? vendor.displayName],
        ['Full name', fullName],
        ['Bill to', billTo.join(', ')],
        ['Main phone', vendor.phone ?? ''],
        ['Work phone', vendor.mobile ?? ''],
        ['Open balance', formatMoney(vendor.balance, currency)],
        [],
        ['Type', 'Num', 'Date', 'Account', 'Amount'],
        ...shown.map((row) => [row.kind, row.number, row.date, row.account ?? '', formatMoney(row.amount, currency)]),
      ]
    : [...companyLines, [], ['Name', 'Balance'], ...page.rows.map((row) => [row.displayName, formatMoney(row.balance, currency)])]

  const bandHref = (key: string) => {
    const next = new URLSearchParams()
    if (query.q) next.set('q', query.q)
    if (includeInactive) next.set('archived', '1')
    if (sort.sort !== 'name') next.set('sort', sort.sort)
    if (sort.dir !== 'asc') next.set('dir', sort.dir)
    if (datePreset) next.set('date', datePreset)
    if (tx) next.set('tx', tx)
    if (txSort) next.set('txSort', txSort)
    if (txSort) next.set('txDir', txDir)
    if (rowMode !== 'split') next.set('rows', rowMode)
    if (tab !== 'transactions') next.set('tab', tab)
    if (vendor?.id) next.set('id', vendor.id)
    if (band !== key) next.set('band', key)
    const text = next.toString()
    return text ? `/vendors?${text}` : '/vendors'
  }

  return (
    <ContactCenter
      title="Vendor information"
      moneyBar={
        <ContactMoneyBar
          storageKey="bp-vendor-money-bar"
          currency={currency}
          active={band}
          bands={[
            {
              key: 'orders',
              href: bandHref('orders'),
              amount: bar.orders.amount,
              detail: vendorBandDetail(bar.orders),
              bar: 'bg-[#5ec8e5]',
            },
            {
              key: 'overdue',
              href: bandHref('overdue'),
              amount: bar.overdue.amount,
              detail: vendorBandDetail(bar.overdue),
              bar: 'bg-[#d4652f]',
              accent: 'text-[#d4652f]',
            },
            {
              key: 'open',
              href: bandHref('open'),
              amount: bar.open.amount,
              detail: vendorBandDetail(bar.open),
              bar: 'bg-[#c5c9ce]',
            },
            {
              key: 'paid',
              href: bandHref('paid'),
              amount: bar.paid.amount,
              detail: vendorBandDetail(bar.paid),
              bar: 'bg-[#2ca01c]',
            },
          ]}
        />
      }
      people={page.rows.map((row) => ({
        id: row.id,
        name: row.displayName,
        balance: row.balance,
        active: row.isActive,
      }))}
      selectedId={vendor?.id}
      personHref={vendorHref}
      profile={
        vendor
          ? {
              company: vendor.companyName ?? vendor.displayName,
              fullName,
              billTo,
              phone: vendor.phone,
              workPhone: vendor.mobile,
              email: vendor.email,
              notes: vendor.notes,
              balance: vendor.balance,
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
      filterPath="/vendors"
      filterParams={filterParams}
      activitySort={txSort ? { sort: txSort, dir: txDir } : undefined}
      peopleSort={
        isPeopleSort(sort.sort) ? { sort: sort.sort, dir: sort.dir } : undefined
      }
      newContact={
        <>
          {canCreate ? <ImportDialog kind="vendor" columns={VENDOR_COLUMNS} /> : null}
          {canCreate ? (
            <NewContactButton
              side="vendor"
              terms={termOptions}
              expenseAccounts={expenseOptions}
              today={asOf}
              currency={currency}
              className="bg-[#2ca01c] text-white hover:bg-[#248a18]"
            />
          ) : null}
        </>
      }
      headerExtra={
        vendor ? (
          <VendorActions
            vendorId={vendor.id}
            contact={vendor}
            terms={termOptions}
            expenseAccounts={expenseOptions}
            today={asOf}
            currency={currency}
            canBill={canBill}
            canPay={canPay}
            canReport={canReport}
            canEdit={canEdit}
            canArchive={canArchive}
            isActive={vendor.isActive}
          />
        ) : null
      }
      archivedHref={archivedHref}
      archivedLabel={includeInactive ? 'Hide archived' : 'Archived'}
      transactions={transactions}
      reports={reports}
      excelHref={exportHref}
      wordTitle={vendor ? vendor.displayName : 'Vendors'}
      wordRows={wordRows}
      chooseLabel="Choose a vendor on the left. Double-click for QuickReport, or use … for bills, receiving, and more."
      contactSide="vendor"
      canCreateDocs={canBill}
      canPay={canPay}
      canReport={canReport}
      canArchive={canArchive}
    />
  )
}
