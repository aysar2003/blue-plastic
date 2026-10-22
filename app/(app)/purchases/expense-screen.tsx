import Link from 'next/link'
import { ReceiptIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { GiveFeedback } from '@/components/data/give-feedback'
import { Pagination } from '@/components/data/pagination'
import { PrintPageButton } from '@/components/data/print-page-button'
import { QuerySelect } from '@/components/data/query-select'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { ExpenseHome } from '@/components/purchases/expense-home'
import { ExpenseTable } from '@/components/purchases/expense-table'
import { NewTransactionMenu } from '@/components/purchases/new-transaction-menu'
import { VendorFilter } from '@/components/purchases/vendor-filter'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate, today } from '@/lib/date'
import { EXPENSE_KINDS, parseExpenseKind } from '@/lib/expense-kinds'
import { DATE_PRESETS, listHref, presetRange, readDatePreset } from '@/lib/list-filters'
import { requireOrgContext } from '@/server/auth/context'
import { expenseRegister } from '@/server/services/expense-register'
import * as purchaseService from '@/server/services/purchase.service'

const PATH = '/purchases/expenses'

const DATE_OPTIONS = [
  { value: 'all', label: 'All dates' },
  ...DATE_PRESETS.filter((preset) => preset.value).map((preset) => ({ value: preset.value, label: preset.label })),
]

export async function ExpenseScreen({
  search,
}: {
  search: Record<string, string | string[] | undefined>
}) {
  const ctx = await requireOrgContext('bill:read')
  const q = typeof search.q === 'string' ? search.q : undefined
  const dateRaw = typeof search.date === 'string' ? search.date : 'last12'
  const datePreset = dateRaw === 'all' ? '' : readDatePreset(dateRaw)
  const range = presetRange(datePreset || (dateRaw === 'last12' ? 'last12' : ''), today(ctx.organization.timeZone))
  const kind = parseExpenseKind(typeof search.kind === 'string' ? search.kind : '')
  const statusRaw = typeof search.status === 'string' ? search.status : ''
  const status = statusRaw === 'open' || statusRaw === 'paid' ? statusRaw : undefined
  const vendorId = typeof search.vendorId === 'string' ? search.vendorId : undefined

  const [register, home, vendors] = await Promise.all([
    expenseRegister(ctx, {
      kind,
      status,
      q,
      vendorId,
      from: range?.from,
      to: range?.to,
    }),
    purchaseService.expenseHome(ctx),
    purchaseService.vendorChoices(ctx),
  ])

  const hidden = {
    q,
    kind: kind || undefined,
    status,
    date: dateRaw,
    vendorId,
  }
  const canExpense = ctx.permissions.has('expense:create')
  const canBill = ctx.permissions.has('bill:create')
  const currency = ctx.organization.baseCurrency
  const homeActive =
    dateRaw === 'today' || dateRaw === 'month' || dateRaw === 'year' || dateRaw === 'all'
      ? dateRaw
      : dateRaw === 'last3' || !dateRaw
        ? 'all'
        : dateRaw

  return (
    <>
      <ExpenseHome
        currency={currency}
        canCreate={canExpense}
        active={homeActive}
        params={hidden}
        home={home}
      />

      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <GiveFeedback />
        {canExpense ? (
          <Link href="/bill-payments/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Pay bills
          </Link>
        ) : null}
        <NewTransactionMenu canBill={canBill} canExpense={canExpense} />
        <PrintPageButton />
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <VendorFilter vendors={vendors.map((vendor) => ({ value: vendor.id, label: vendor.displayName }))} />
        <QuerySelect
          label=""
          param="kind"
          path={PATH}
          value={kind}
          hidden={{ ...hidden, kind: undefined }}
          options={EXPENSE_KINDS.map((item) => ({ value: item.value, label: item.label }))}
          className="min-w-44"
        />
        <QuerySelect
          label="Filter"
          param="status"
          path={PATH}
          value={status ?? ''}
          hidden={{ ...hidden, status: undefined }}
          options={[
            { value: '', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'paid', label: 'Paid or closed' },
          ]}
        />
        <QuerySelect
          label="Dates"
          param="date"
          path={PATH}
          value={dateRaw}
          hidden={{ ...hidden, date: undefined }}
          options={DATE_OPTIONS}
        />
      </div>

      {range ? (
        <p className="mb-3 text-xs text-muted-foreground">
          <Link href={listHref(PATH, { ...hidden, date: 'all' })} className="rounded-full bg-muted px-2 py-1 hover:underline">
            Dates: {formatDate(range.from)} – {formatDate(range.to)} ×
          </Link>
        </p>
      ) : null}

      <div className="mb-4">
        <SearchInput placeholder="Search number, memo or payee" />
      </div>

      {register.rows.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="No expenses match"
          description="Try another type or date, or record a bill, expense, or payment."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <ExpenseTable
              rows={register.rows}
              currency={ctx.organization.baseCurrency}
              totals={register.totals}
              canEdit={ctx.permissions.has('bill:update') || ctx.permissions.has('expense:update')}
              listParams={hidden}
            />
          </ScrollSheet>
          <Pagination total={register.rows.length} />
        </Card>
      )}
    </>
  )
}
