import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpenIcon } from 'lucide-react'

import { AccountTypeMark } from '@/components/accounts/account-type-icon'
import { BooksTabs } from '@/components/accounts/books-tabs'
import { QuerySelect } from '@/components/data/query-select'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { SearchInput } from '@/components/data/search-input'
import { TableToolbar } from '@/components/data/table-toolbar'
import { readSort } from '@/components/data/sortable-header'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER, isProfitAndLossType } from '@/lib/accounting-labels'
import type { AccountType } from '@prisma/client'
import { ACCOUNT_VIEWS, accountMatchesView, parseAccountView } from '@/lib/account-views'
import { keepChartFamily, nestChartRows } from '@/lib/chart-tree'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import { ChartTable } from './chart-table'
import { NewAccountButton, type ParentOption } from './account-dialog'
import { ImportChartButton } from './import-chart-button'
import { InstallChartButton } from './install-chart-button'

export const metadata: Metadata = { title: 'Chart of accounts' }

const SORTABLE = ['code', 'name', 'type', 'subtype', 'balance'] as const

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('account:read')
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const showArchived = params.archived === '1'
  const typeParam = typeof params.type === 'string' ? params.type : ''
  const typeFilter = (ACCOUNT_TYPE_ORDER as readonly string[]).includes(typeParam)
    ? (typeParam as AccountType)
    : undefined
  const sort = readSort(params, SORTABLE, { sort: 'code', dir: 'asc' })

  // Load the whole chart, then filter in memory so a matching sub-account still
  // brings its parent (and children) — hierarchy never drops mid-tree.
  const accounts = await accountService.list(ctx, { includeInactive: showArchived })

  const canCreate = ctx.permissions.has('account:create')
  const canEdit = ctx.permissions.has('account:update')
  const canArchive = ctx.permissions.has('account:archive')
  const canDelete = ctx.permissions.has('account:delete') && ctx.features.allowAccountDelete
  const canReport = ctx.permissions.has('report:read')
  const canReconcile = ctx.permissions.has('bank:reconcile')
  const asOf = today(ctx.organization.timeZone)
  const currency = ctx.organization.baseCurrency

  const parents: ParentOption[] = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
  }))

  if (accounts.length === 0 && !q && !showArchived) {
    return (
      <>
        <BooksTabs active="chart" />
        <PageHeader
          organization={ctx.organization}
          title="Chart of accounts"
          description="Every account the business posts to, and the balance sitting in each."
        />
        <EmptyState
          icon={BookOpenIcon}
          title="No accounts yet"
          description="Start from a standard chart for a goods-trading business — assets, liabilities, equity, income, cost of sales and expenses, including the control accounts the system posts to. You can rename, renumber and extend everything afterwards."
          action={canCreate ? <InstallChartButton /> : undefined}
        />
      </>
    )
  }

  // The chart is ordered by statement type first — assets, liabilities, equity,
  // income, expenses — because that is the order an accountant reads it in, and
  // account numbers only sort correctly *within* a type.
  const statement =
    params.statement === 'balance' || params.statement === 'profit' ? params.statement : ''
  const view = parseAccountView(typeof params.view === 'string' ? params.view : '')
  const needle = q?.trim().toLowerCase()
  const matched = accounts.filter((account) => {
    if (needle) {
      const hay = `${account.code} ${account.name}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    if (!accountMatchesView(account, view)) return false
    if (typeFilter && account.type !== typeFilter) return false
    if (statement === 'balance') {
      return account.type === 'ASSET' || account.type === 'LIABILITY' || account.type === 'EQUITY'
    }
    if (statement === 'profit') return isProfitAndLossType(account.type)
    return true
  })
  const typeCounts = new Map<AccountType, number>()
  for (const account of accounts) {
    typeCounts.set(account.type, (typeCounts.get(account.type) ?? 0) + 1)
  }

  // Always nest: sub-accounts sit under their parent for every filter and sort.
  const rows = nestChartRows(keepChartFamily(accounts, matched))
  const total = rows.length

  const linkParams = {
    q,
    archived: showArchived ? '1' : undefined,
    type: typeFilter,
    statement: statement || undefined,
    view: view || undefined,
    sort: sort.sort,
    dir: sort.dir,
  }

  const statementHref = (value: '' | 'balance' | 'profit') => {
    const search = new URLSearchParams()
    if (q) search.set('q', q)
    if (showArchived) search.set('archived', '1')
    if (typeFilter) search.set('type', typeFilter)
    if (view) search.set('view', view)
    if (value) search.set('statement', value)
    const query = search.toString()
    return query ? `/accounts?${query}` : '/accounts'
  }

  const chipHref = (type?: AccountType) => {
    const search = new URLSearchParams()
    if (q) search.set('q', q)
    if (showArchived) search.set('archived', '1')
    if (view) search.set('view', view)
    if (statement) search.set('statement', statement)
    if (type) search.set('type', type)
    const query = search.toString()
    return query ? `/accounts?${query}` : '/accounts'
  }

  return (
    <>
      <BooksTabs active="chart" />
      <PageHeader
        organization={ctx.organization}
        title="Chart of accounts"
        description={`Balances as at ${asOf}, shown on each account's natural side. Right-click an account for its register, its report, and the actions the books allow.`}
        actions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              <ImportChartButton />
              <NewAccountButton
                parents={parents}
                today={today(ctx.organization.timeZone)}
                currency={currency}
              />
            </div>
          ) : undefined
        }
      />

      <div className="mb-2 flex flex-wrap gap-1">
        <TypeChip href={statementHref('')} active={!statement} label="Whole chart" />
        <TypeChip href={statementHref('balance')} active={statement === 'balance'} label="Balance sheet" />
        <TypeChip href={statementHref('profit')} active={statement === 'profit'} label="Profit and loss" />
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        <TypeChip href={chipHref()} active={!typeFilter} label={`All · ${accounts.length}`} />
        {ACCOUNT_TYPE_ORDER.map((type) => (
          <TypeChip
            key={type}
            href={chipHref(type)}
            active={typeFilter === type}
            label={
              <AccountTypeMark
                type={type}
                label={`${ACCOUNT_TYPE_LABELS[type]} · ${typeCounts.get(type) ?? 0}`}
              />
            }
          />
        ))}
      </div>
      <p className="mb-3 text-xs text-muted-foreground print:hidden">
        Click a name to open its register. Right-click for the report, edit, and archive. Type a few
        letters in the search and the list narrows.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <QuerySelect
          label=""
          param="view"
          path="/accounts"
          value={view}
          hidden={{
            q,
            archived: showArchived ? '1' : undefined,
            type: typeFilter,
            statement: statement || undefined,
            sort: sort.sort,
            dir: sort.dir,
          }}
          options={ACCOUNT_VIEWS.map((item) => ({ value: item.value, label: item.label }))}
          className="min-w-56"
        />
        <SearchInput placeholder="Filter by name or number" />
        <Link
          href={showArchived ? '/accounts' : '/accounts?archived=1'}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Link>
        <Link
          href="/settings/accounts"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Which account the system posts to
        </Link>
        <div className="ml-auto">
          <TableToolbar exportHref={`/api/exports/accounts?${new URLSearchParams(
            Object.entries(linkParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
          ).toString()}`} />
        </div>
      </div>

      {total === 0 ? (
        <EmptyState icon={BookOpenIcon} title="No accounts in this view" />
      ) : (
        <ChartTable
          rows={rows.map((account) => ({
            id: account.id,
            code: account.code,
            name: account.name,
            description: account.description,
            detailType: account.detailType,
            type: account.type,
            subtype: account.subtype,
            parentId: account.parentId,
            isSystem: account.isSystem,
            isActive: account.isActive,
            balance: account.balance,
            treeDepth: account.treeDepth,
            hasChildren: account.hasChildren,
          }))}
          parents={parents}
          currency={currency}
          sort={sort}
          linkParams={linkParams}
          canEdit={canEdit}
          canArchive={canArchive}
          canDelete={canDelete}
          canReport={canReport}
          canReconcile={canReconcile}
          canTransact={ctx.permissions.has('bank:transact')}
          today={asOf}
        />
      )}
    </>
  )
}

function TypeChip({
  href,
  active,
  label,
}: {
  href: string
  active: boolean
  label: import('react').ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
          : 'rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }
    >
      {label}
    </Link>
  )
}

