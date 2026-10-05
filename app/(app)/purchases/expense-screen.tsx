import Link from 'next/link'
import { ReceiptIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { GiveFeedback } from '@/components/data/give-feedback'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { PrintPageButton } from '@/components/data/print-page-button'
import { QuerySelect } from '@/components/data/query-select'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { ExpenseTable } from '@/components/purchases/expense-table'
import { NewTransactionMenu } from '@/components/purchases/new-transaction-menu'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate, today } from '@/lib/date'
import { EXPENSE_KINDS, parseExpenseKind } from '@/lib/expense-kinds'
import { DATE_PRESETS, listHref, presetRange, readDatePreset } from '@/lib/list-filters'
import { requireOrgContext } from '@/server/auth/context'
import { expenseRegister } from '@/server/services/expense-register'

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

  const register = await expenseRegister(ctx, {
    kind,
    status,
    q,
    from: range?.from,
    to: range?.to,
  })

  const hidden = {
    q,
    kind: kind || undefined,
    status,
    date: dateRaw,
  }
  const canExpense = ctx.permissions.has('expense:create')
  const canBill = ctx.permissions.has('bill:create')

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Bills, bill payments, purchase orders, and supplier credits. Totals follow the sign of each row."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <GiveFeedback />
            {canExpense ? (
              <Link href="/bill-payments/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Pay bills
              </Link>
            ) : null}
            <NewTransactionMenu canBill={canBill} canExpense={canExpense} />
            <PrintPageButton />
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
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
            />
          </ScrollSheet>
          <Pagination total={register.rows.length} />
        </Card>
      )}
    </>
  )
}
