import type { Metadata } from 'next'

import { ContactCenter, isActivitySort, readCenterRowMode, sortCenterRows, type CenterTab } from '@/components/contacts/contact-center'
import { EditContact } from '@/components/contacts/edit-contact'
import { FilterChips } from '@/components/data/filter-chips'
import { ImportDialog } from '@/components/master-data/import-dialog'
import { NewContactButton } from '@/components/master-data/contact-dialog'
import { readSort } from '@/components/data/sortable-header'
import { accountOptions } from '@/lib/account-options'
import { today } from '@/lib/date'
import { presetRange, readDatePreset } from '@/lib/list-filters'
import { letterheadLines } from '@/lib/letterhead'
import { formatMoney } from '@/lib/money'
import { describeTerm } from '@/lib/payment-terms'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import * as contactService from '@/server/services/contact.service'
import * as taxService from '@/server/services/tax.service'
import { vendorActivity } from '@/server/services/vendor-activity'
import { VENDOR_COLUMNS } from '@/server/services/import.service'

export const metadata: Metadata = { title: 'Vendors' }

const SORTABLE = ['name', 'email', 'phone', 'company'] as const
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
  const owing = params.balance === 'open'
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
  const owingIds = owing ? await contactService.vendorIdsWithBalance(ctx) : undefined

  const [page, terms, accounts] = await Promise.all([
    contactService.listVendors(ctx, query, { includeInactive, ...sort, ids: owingIds }),
    taxService.listPaymentTerms(ctx),
    accountService.selectableAccounts(ctx),
  ])

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
    if (owing) next.set('balance', 'open')
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
  if (owing) archivedQuery.set('balance', 'open')
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
    balance: owing ? 'open' : undefined,
    id: vendor?.id,
    date: datePreset || undefined,
    tx: tx || undefined,
    tab: tab === 'transactions' ? undefined : tab,
    txSort: txSort || undefined,
    txDir: txSort ? txDir : undefined,
    rows: rowMode === 'split' ? undefined : rowMode,
  }

  const tabHref = (nextTab: CenterTab) => {
    const next = new URLSearchParams()
    if (query.q) next.set('q', query.q)
    if (includeInactive) next.set('archived', '1')
    if (owing) next.set('balance', 'open')
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
      balance: owing ? 'open' : undefined,
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
      ]
    : []

  const reports = vendor && canReport
    ? [
        { label: 'QuickReport', href: `/reports/statements/vendor?vendorId=${id}&period=all-dates` },
        { label: 'Open balance', href: `/reports/statements/vendor?vendorId=${id}&period=all-dates` },
        { label: 'Show purchase orders', href: withTx(vendorHref(vendor.id), 'Purchase order') },
        { label: 'Vendor snapshot', href: `/reports/statements/vendor?vendorId=${id}&period=all-dates` },
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

  return (
    <div className="space-y-3">
      <FilterChips
        options={[
          { value: '', label: 'All vendors' },
          { value: 'open', label: 'With a balance' },
        ]}
        active={owing ? 'open' : ''}
        path="/vendors"
        param="balance"
        params={filterParams}
      />
      <ContactCenter
        title="Vendor information"
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
          vendor && canEdit ? (
            <EditContact
            side="vendor"
              contact={{ ...vendor, id: vendor.id }}
            terms={termOptions}
            expenseAccounts={expenseOptions}
              today={asOf}
              currency={currency}
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
        chooseLabel="Choose a vendor on the left. Their details and transactions show here."
      />
    </div>
  )
}
