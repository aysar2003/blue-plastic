import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, ChevronRightIcon, ChevronsUpDownIcon } from 'lucide-react'

import { WordFile } from '@/components/contacts/word-file'
import { FilterChips } from '@/components/data/filter-chips'
import { SearchInput } from '@/components/data/search-input'
import { DATE_PRESETS } from '@/lib/list-filters'
import { formatDate } from '@/lib/date'
import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const SHEET =
  'min-h-full bg-[linear-gradient(to_bottom,transparent_2.15rem,var(--border)_2.15rem,var(--border)_calc(2.15rem+1px))] bg-[length:100%_2.2rem]'

export type CenterPerson = {
  id: string
  name: string
  balance: string
  active: boolean
}

export type CenterTransaction = {
  id: string
  href: string
  kind: string
  number: string
  date: string
  account: string | null
  amount: string
}

export type CenterProfile = {
  company: string
  fullName: string
  billTo: string[]
  phone: string | null
  workPhone: string | null
  email: string | null
  notes: string | null
  balance: string
}

const ACTIVITY_COLUMNS = [
  { key: 'type', label: 'Type' },
  { key: 'num', label: 'Num' },
  { key: 'date', label: 'Date' },
  { key: 'account', label: 'Account' },
  { key: 'amount', label: 'Amount' },
] as const

export type ActivitySortKey = (typeof ACTIVITY_COLUMNS)[number]['key']

export function isActivitySort(value: string | undefined): value is ActivitySortKey {
  return ACTIVITY_COLUMNS.some((column) => column.key === value)
}

/** Orders the rows on screen. Amounts compare as money, so 10 comes after 4. */
export function sortCenterRows<T extends CenterTransaction>(rows: T[], sort: string, dir: 'asc' | 'desc'): T[] {
  if (!isActivitySort(sort)) return rows
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const cmp = compareActivity(a, b, sort)
    return cmp === 0 ? a.number.localeCompare(b.number, undefined, { numeric: true }) * sign : cmp * sign
  })
}

function compareActivity(a: CenterTransaction, b: CenterTransaction, sort: ActivitySortKey) {
  switch (sort) {
    case 'type':
      return a.kind.localeCompare(b.kind)
    case 'num':
      return a.number.localeCompare(b.number, undefined, { numeric: true })
    case 'date':
      return a.date.localeCompare(b.date)
    case 'account':
      return (a.account ?? '').localeCompare(b.account ?? '')
    case 'amount':
      return new Decimal(a.amount).comparedTo(b.amount)
  }
}

const TABS = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'tasks', label: "To Do's" },
  { id: 'notes', label: 'Notes' },
  { id: 'mail', label: 'Sent Email' },
] as const

export type CenterTab = (typeof TABS)[number]['id']

export const CENTER_ROW_MODES = ['split', 'arrow', 'group'] as const
export type CenterRowMode = (typeof CENTER_ROW_MODES)[number]

const ROW_MODE_LABELS: Record<CenterRowMode, string> = {
  arrow: 'Open one by one',
  group: 'Grouped',
  split: 'Separated',
}

export function readCenterRowMode(value: string | string[] | undefined): CenterRowMode {
  const mode = Array.isArray(value) ? value[0] : value
  return mode === 'arrow' || mode === 'group' ? mode : 'split'
}

export function ContactCenter({
  title,
  people,
  selectedId,
  personHref,
  profile,
  rows,
  currency,
  tab,
  tabHref,
  kinds,
  activeKind,
  datePreset,
  rowMode = 'split',
  filterPath,
  filterParams,
  activitySort,
  newContact,
  headerExtra,
  archivedHref,
  archivedLabel,
  transactions,
  reports,
  excelHref,
  wordTitle,
  wordRows,
  chooseLabel,
  profileExtra,
}: {
  title: string
  people: CenterPerson[]
  selectedId?: string
  personHref: (id: string) => string
  profile: CenterProfile | null
  rows: CenterTransaction[]
  currency: string
  tab: CenterTab
  tabHref: (tab: CenterTab) => string
  kinds: { value: string; label: string }[]
  activeKind: string
  datePreset: string
  rowMode?: CenterRowMode
  filterPath: string
  filterParams: Record<string, string | undefined>
  activitySort?: { sort: ActivitySortKey; dir: 'asc' | 'desc' }
  newContact: ReactNode
  headerExtra?: ReactNode
  archivedHref?: string
  archivedLabel?: string
  transactions: { label: string; href: string }[]
  reports: { label: string; href: string }[]
  excelHref: string
  wordTitle: string
  wordRows: string[][]
  chooseLabel: string
  profileExtra?: ReactNode
}) {
  const ordered = activitySort ? sortCenterRows(rows, activitySort.sort, activitySort.dir) : rows

  const columnHref = (column: ActivitySortKey) => {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(filterParams)) {
      if (value && key !== 'txSort' && key !== 'txDir') next.set(key, value)
    }
    next.set('txSort', column)
    next.set('txDir', activitySort?.sort === column && activitySort.dir === 'asc' ? 'desc' : 'asc')
    return `${filterPath}?${next.toString()}`
  }

  const groups = groupTransactions(ordered)

  return (
    <section className="flex h-[calc(100dvh-7.25rem)] flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
        {newContact}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1.5 text-sm">
            New transactions
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {transactions.length === 0 ? (
              <DropdownMenuItem disabled>Choose a name first</DropdownMenuItem>
            ) : (
              transactions.map((item) => (
                <DropdownMenuItem key={item.label} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1.5 text-sm">
            Print
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem asChild>
              <a href={excelHref}>Excel</a>
            </DropdownMenuItem>
            <WordFile filename={`${title.toLowerCase()}.doc`} title={wordTitle} rows={wordRows} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <SearchInput placeholder="Find a name" />
            </div>
            {archivedHref ? (
              <Link href={archivedHref} className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline">
                {archivedLabel}
              </Link>
            ) : null}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] border-b px-2 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Name</span>
            <span className="text-right">Balance</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className={SHEET}>
              {people.map((person) => {
                const on = person.id === selectedId
                return (
                  <Link
                    key={person.id}
                    href={personHref(person.id)}
                    aria-current={on ? 'true' : undefined}
                    className={cn(
                      'grid h-[2.2rem] grid-cols-[minmax(0,1fr)_5.5rem] items-center px-2 text-sm',
                      on ? 'bg-[#b7e1a1] font-medium' : 'hover:bg-accent',
                      !person.active && 'opacity-55',
                    )}
                  >
                    <span className="truncate uppercase">{person.name}</span>
                    <span className="tabular text-right text-xs">{formatMoney(person.balance, currency)}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-semibold">{title}</h1>
                {headerExtra ? <div className="flex shrink-0 items-center [&>div]:flex-row [&>div]:gap-1">{headerExtra}</div> : null}
              </div>
              {profile ? (
                <>
                <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Company name</dt>
                    <dd>{profile.company}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Main phone</dt>
                    <dd>{profile.phone ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Full name</dt>
                    <dd className="uppercase">{profile.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Work phone</dt>
                    <dd>{profile.workPhone ?? '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Bill to</dt>
                    <dd>{profile.billTo.length > 0 ? profile.billTo.join(', ') : '—'}</dd>
                  </div>
                </dl>
                {profileExtra}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{chooseLabel}</p>
              )}
            </div>
            {profile && reports.length > 0 ? (
              <div className="hidden w-40 shrink-0 sm:block">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Reports</p>
                <ul className="mt-1 space-y-1">
                  {reports.map((report) => (
                    <li key={report.label}>
                      <Link href={report.href} className="text-sm text-[#0b4f6c] underline-offset-4 hover:underline">
                        {report.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex gap-1 overflow-x-auto border-b px-2 py-1">
            {TABS.map((item) => (
              <Link
                key={item.id}
                href={tabHref(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm',
                  tab === item.id ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {tab === 'transactions' ? (
              <div className="flex min-h-full flex-col">
                <div className="flex flex-col gap-2 border-b px-3 py-2">
                  <FilterChips
                    options={[{ value: '', label: 'All' }, ...kinds]}
                    active={activeKind}
                    path={filterPath}
                    param="tx"
                    params={filterParams}
                  />
                  <FilterChips options={[...DATE_PRESETS]} active={datePreset} path={filterPath} param="date" params={filterParams} />
                  <FilterChips
                    options={CENTER_ROW_MODES.map((mode) => ({ value: mode === 'split' ? '' : mode, label: ROW_MODE_LABELS[mode] }))}
                    active={rowMode === 'split' ? '' : rowMode}
                    path={filterPath}
                    param="rows"
                    params={filterParams}
                  />
                </div>
                <div className="flex min-h-0 min-w-[42rem] flex-1 flex-col">
                <div className="grid grid-cols-[7rem_6rem_7.5rem_minmax(0,1fr)_7rem] border-b bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  {ACTIVITY_COLUMNS.map((column) => {
                    const active = activitySort?.sort === column.key
                    const Icon = active ? (activitySort.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon) : ChevronsUpDownIcon
                    return (
                      <Link
                        key={column.key}
                        href={columnHref(column.key)}
                        scroll={false}
                        aria-sort={active ? (activitySort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={cn(
                          'inline-flex items-center gap-0.5 hover:text-foreground',
                          column.key === 'amount' && 'justify-end',
                        )}
                      >
                        {column.label}
                        <Icon className={cn('size-3 shrink-0', active ? 'opacity-80' : 'opacity-35')} />
                      </Link>
                    )
                  })}
                </div>
                <div className={cn(SHEET, 'min-w-[42rem] flex-1')}>
                  {rowMode === 'group'
                    ? groups.map((group) => (
                        <div
                          key={group.kind}
                          className="grid h-[2.2rem] grid-cols-[7rem_6rem_7.5rem_minmax(0,1fr)_7rem] items-center border-b border-border/70 bg-card px-3 text-sm"
                        >
                          <span className="truncate font-medium">{group.kind}</span>
                          <span className="text-muted-foreground">{group.rows.length}</span>
                          <span />
                          <span className="truncate text-muted-foreground">One row</span>
                          <span className="tabular text-right">{formatMoney(group.total, currency)}</span>
                        </div>
                      ))
                    : null}
                  {rowMode === 'arrow'
                    ? groups.map((group) => (
                        <details key={group.kind} className="group border-b border-border/70 bg-card">
                          <summary className="grid h-[2.2rem] cursor-pointer list-none grid-cols-[1.1rem_7rem_6rem_7.5rem_minmax(0,1fr)_7rem] items-center px-2 text-sm [&::-webkit-details-marker]:hidden">
                            <ChevronRightIcon className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                            <span className="truncate font-medium">{group.kind}</span>
                            <span className="text-muted-foreground">{group.rows.length}</span>
                            <span />
                            <span className="truncate text-muted-foreground">Open</span>
                            <span className="tabular text-right">{formatMoney(group.total, currency)}</span>
                          </summary>
                          {group.rows.map((row, index) => (
                            <TransactionLine key={`${row.kind}-${row.id}`} row={row} currency={currency} index={index} inset />
                          ))}
                        </details>
                      ))
                    : null}
                  {rowMode === 'split'
                    ? ordered.map((row, index) => (
                        <TransactionLine key={`${row.kind}-${row.id}`} row={row} currency={currency} index={index} />
                      ))
                    : null}
                </div>
                </div>
              </div>
            ) : null}
            {tab === 'contacts' ? (
              <Panel>
                {profile ? (
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <Field label="Email" value={profile.email} />
                    <Field label="Main phone" value={profile.phone} />
                    <Field label="Work phone" value={profile.workPhone} />
                    <Field label="Bill to" value={profile.billTo.join(', ') || null} />
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">{chooseLabel}</p>
                )}
              </Panel>
            ) : null}
            {tab === 'notes' ? (
              <Panel>
                <p className="whitespace-pre-wrap text-sm">{profile?.notes?.trim() || 'No notes on this record.'}</p>
              </Panel>
            ) : null}
            {tab === 'tasks' ? (
              <Panel>
                <p className="text-sm text-muted-foreground">No to-do list is kept on this record.</p>
              </Panel>
            ) : null}
            {tab === 'mail' ? (
              <Panel>
                <p className="text-sm text-muted-foreground">No sent email is stored for this record.</p>
              </Panel>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t px-2 py-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-sm">
                Manage transactions
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {transactions.length === 0 ? (
                  <DropdownMenuItem disabled>Choose a name first</DropdownMenuItem>
                ) : (
                  transactions.map((item) => (
                    <DropdownMenuItem key={item.label} asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {reports[0] ? (
              <Link href={reports[0].href} className="rounded-md border bg-card px-2.5 py-1 text-sm hover:bg-accent">
                Run reports
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function TransactionLine({
  row,
  currency,
  index,
  inset,
}: {
  row: CenterTransaction
  currency: string
  index: number
  inset?: boolean
}) {
  return (
    <Link
      href={row.href}
      className={cn(
        'grid h-[2.2rem] items-center px-3 text-sm hover:bg-[#d7ebf6]',
        inset
          ? 'grid-cols-[1.1rem_7rem_6rem_7.5rem_minmax(0,1fr)_7rem] border-t border-border/40 pl-2'
          : 'grid-cols-[7rem_6rem_7.5rem_minmax(0,1fr)_7rem]',
        !inset && index % 2 === 1 && 'bg-muted/30',
        inset && 'bg-muted/20',
      )}
    >
      {inset ? <span /> : null}
      <span className="truncate">{row.kind}</span>
      <span className="truncate font-medium">{row.number}</span>
      <span className="tabular text-muted-foreground">{formatDate(row.date)}</span>
      <span className="truncate text-muted-foreground">{row.account ?? '—'}</span>
      <span className="tabular text-right">{formatMoney(row.amount, currency)}</span>
    </Link>
  )
}

function groupTransactions(rows: CenterTransaction[]) {
  const order: string[] = []
  const byKind = new Map<string, CenterTransaction[]>()
  for (const row of rows) {
    const list = byKind.get(row.kind)
    if (list) list.push(row)
    else {
      order.push(row.kind)
      byKind.set(row.kind, [row])
    }
  }
  return order.map((kind) => {
    const groupRows = byKind.get(kind) ?? []
    return {
      kind,
      rows: groupRows,
      total: groupRows.reduce((sum, row) => sum.plus(row.amount), new Decimal(0)),
    }
  })
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="p-4">{children}</div>
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value?.trim() || '—'}</dd>
    </div>
  )
}
