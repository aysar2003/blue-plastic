import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeftRightIcon, BanknoteIcon, UploadIcon } from 'lucide-react'

import { ClickableRow } from '@/components/data/clickable-row'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { AccountTableRow } from '@/app/(app)/accounts/account-row-actions'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DeleteButton } from '@/components/data/delete-record'
import {
  ACCOUNT_SUBTYPE_LABELS,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
} from '@/lib/accounting-labels'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { Decimal, formatMoney } from '@/lib/money'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import * as bankingService from '@/server/services/banking.service'
import { history } from '@/server/services/reconciliation.service'

const SORTABLE = ['name', 'type', 'books', 'bank', 'pending'] as const

/** Money accounts QuickBooks lists as Bank / Credit Card / Undeposited Funds. */
const MONEY_SUBTYPES = new Set(['BANK', 'CREDIT_CARD', 'UNDEPOSITED_FUNDS'])

/** Subtype order within Assets — bank first, like a standard chart. */
const SUBTYPE_RANK: Record<string, number> = {
  BANK: 0,
  UNDEPOSITED_FUNDS: 1,
  CREDIT_CARD: 2,
  ACCOUNTS_RECEIVABLE: 10,
  INVENTORY: 11,
  OTHER_CURRENT_ASSET: 12,
  FIXED_ASSET: 13,
  ACCUMULATED_DEPRECIATION: 14,
  OTHER_ASSET: 15,
  ACCOUNTS_PAYABLE: 20,
  SALES_TAX_PAYABLE: 21,
  OTHER_CURRENT_LIABILITY: 22,
  LONG_TERM_LIABILITY: 23,
  OWNERS_EQUITY: 30,
  RETAINED_EARNINGS: 31,
  OPENING_BALANCE_EQUITY: 32,
  DRAWINGS: 33,
  INCOME: 40,
  OTHER_INCOME: 41,
  SALES_DISCOUNTS: 42,
  COST_OF_GOODS_SOLD: 50,
  OPERATING_EXPENSE: 51,
  OTHER_EXPENSE: 52,
  DEPRECIATION: 53,
}

export const metadata: Metadata = { title: 'Accounts' }

export default async function BankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bank:read')
  const sort = readSort(await searchParams, SORTABLE, { sort: 'type', dir: 'asc' })

  const [chart, bankRows, reconciliations, transfers, deposits] = await Promise.all([
    accountService.list(ctx),
    bankingService.bankAccounts(ctx),
    history(ctx),
    bankingService.listTransfers(ctx, { page: 1, pageSize: 50_000, dir: 'desc' }),
    bankingService.listDeposits(ctx, { page: 1, pageSize: 50_000, dir: 'desc' }),
  ])

  const bankById = new Map(bankRows.map((row) => [row.id, row]))
  const typeRank = new Map(ACCOUNT_TYPE_ORDER.map((type, index) => [type, index]))

  function chartOrder(a: { type: string; subtype: string; code: string }, b: typeof a) {
    return (
      (typeRank.get(a.type as never) ?? 99) - (typeRank.get(b.type as never) ?? 99) ||
      (SUBTYPE_RANK[a.subtype] ?? 99) - (SUBTYPE_RANK[b.subtype] ?? 99) ||
      a.code.localeCompare(b.code)
    )
  }

  const direction = sort.dir === 'asc' ? 1 : -1
  const accounts = chart
    .filter((account) => account.isActive)
    .map((account) => {
      const bank = bankById.get(account.id)
      const books = bank?.balance ?? new Decimal(account.balance)
      return {
        ...account,
        books,
        cleared: bank?.cleared ?? null,
        uncleared: bank?.uncleared ?? null,
        isMoney: MONEY_SUBTYPES.has(account.subtype),
        typeLabel: ACCOUNT_SUBTYPE_LABELS[account.subtype],
        categoryLabel: ACCOUNT_TYPE_LABELS[account.type],
      }
    })
    .sort((a, b) => {
      switch (sort.sort) {
        case 'name':
          return direction * a.code.localeCompare(b.code)
        case 'type':
          return direction * chartOrder(a, b)
        case 'books':
          return direction * a.books.comparedTo(b.books)
        case 'bank':
          return direction * (a.cleared ?? new Decimal(0)).comparedTo(b.cleared ?? new Decimal(0))
        case 'pending':
          return (
            direction * (a.uncleared ?? new Decimal(0)).comparedTo(b.uncleared ?? new Decimal(0))
          )
        default:
          return chartOrder(a, b)
      }
    })

  const currency = ctx.organization.baseCurrency
  const asOf = today(ctx.organization.timeZone)
  const canTransact = ctx.permissions.has('bank:transact')
  const canReconcile = ctx.permissions.has('bank:reconcile')
  const canEdit = ctx.permissions.has('account:update')
  const canArchive = ctx.permissions.has('account:archive')
  const canReport = ctx.permissions.has('report:read')
  const parents = chart.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
  }))

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Full chart in QuickBooks order — Bank and cash (money in hand), then receivables, inventory, liabilities, equity, income and expenses. Balance as of today."
        actions={
          <>
            {ctx.permissions.has('account:read') ? (
              <Link href="/accounts" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Chart of accounts
              </Link>
            ) : null}
            {ctx.permissions.has('bank:import') ? (
              <Link href="/banking/import" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <UploadIcon /> Import statement
              </Link>
            ) : null}
            {canTransact ? (
              <>
                <Link href="/banking/deposits/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <BanknoteIcon /> Make a deposit
                </Link>
                <Link href="/banking/transfers/new" className={buttonVariants({ size: 'sm' })}>
                  <ArrowLeftRightIcon /> Transfer
                </Link>
              </>
            ) : null}
          </>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={BanknoteIcon}
          title="No accounts yet"
          description="Install or add accounts on the chart of accounts, and they will appear here."
        />
      ) : (
        <Card className="mb-6 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="name" label="Account" state={sort} basePath="/banking/accounts" />
                <SortableHeader column="type" label="Type" state={sort} basePath="/banking/accounts" className="w-44" />
                <SortableHeader
                  column="books"
                  label="In the books"
                  state={sort}
                  basePath="/banking/accounts"
                  className="w-36"
                  numeric
                  defaultDirection="desc"
                />
                <SortableHeader
                  column="bank"
                  label="Confirmed by the bank"
                  state={sort}
                  basePath="/banking/accounts"
                  className="w-40"
                  numeric
                  defaultDirection="desc"
                />
                <SortableHeader
                  column="pending"
                  label="Not yet confirmed"
                  state={sort}
                  basePath="/banking/accounts"
                  className="w-40"
                  numeric
                  defaultDirection="desc"
                />
                <TableHead className="w-10 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <AccountTableRow
                  key={account.id}
                  account={{
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
                  }}
                  parents={parents}
                  canEdit={canEdit}
                  canArchive={canArchive}
                  canReport={canReport}
                  canReconcile={canReconcile}
                  canTransact={canTransact}
                  today={asOf}
                >
                  <TableCell>
                    <span className="font-medium">
                      <span className="tabular text-muted-foreground">{account.code}</span>{' '}
                      {account.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block font-medium">{account.typeLabel}</span>
                    <span className="block text-xs text-muted-foreground">
                      {account.categoryLabel}
                    </span>
                  </TableCell>
                  <TableCell className="numeric tabular font-medium">
                    {formatMoney(account.books, currency)}
                  </TableCell>
                  <TableCell className="numeric tabular text-muted-foreground">
                    {account.isMoney && account.cleared != null
                      ? formatMoney(account.cleared, currency)
                      : '—'}
                  </TableCell>
                  <TableCell className="numeric tabular text-muted-foreground">
                    {account.isMoney && account.uncleared != null && !account.uncleared.isZero()
                      ? formatMoney(account.uncleared, currency)
                      : '—'}
                  </TableCell>
                </AccountTableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/*
        Transfers and deposits had no list at all, which meant a transfer entered
        twice stayed in the books for ever — there was no screen from which to
        undo one. They are money movements like any other, so they are listed
        here, in the module that owns them, with the same disposal control every
        other transaction has.
      */}
      <h2 id="transfers" className="mb-3 scroll-mt-20 text-sm font-semibold">
        Transfers and deposits
      </h2>

      {transfers.rows.length === 0 && deposits.rows.length === 0 ? (
        <Card className="mb-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No transfers or deposits yet. A transfer moves money between two of the business&rsquo;s own
            accounts; a deposit takes what is in hand to the bank.
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Number</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-28">Kind</TableHead>
                <TableHead>Accounts</TableHead>
                <TableHead className="numeric w-32">Amount</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ...transfers.rows.map((row) => ({
                  id: row.id,
                  number: row.number,
                  date: row.date,
                  kind: 'transfer' as const,
                  detail: `${row.fromAccount.code} ${row.fromAccount.name} → ${row.toAccount.code} ${row.toAccount.name}`,
                  amount: row.amount,
                  status: row.status,
                  journalId: row.journalId,
                })),
                ...deposits.rows.map((row) => ({
                  id: row.id,
                  number: row.number,
                  date: row.date,
                  kind: 'deposit' as const,
                  detail: `${row.bankAccount.code} ${row.bankAccount.name}`,
                  amount: row.total,
                  status: row.status,
                  journalId: row.journalId,
                })),
              ]
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map((row) => (
                  <ClickableRow
                    key={`${row.kind}-${row.id}`}
                    href={row.journalId ? `/journals/${row.journalId}` : undefined}
                    title={row.journalId ? `Open ${row.number}` : undefined}
                  >
                    <TableCell className="tabular font-medium">{row.number}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {formatDate(toCalendarDate(row.date))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.kind === 'transfer' ? 'Transfer' : 'Deposit'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.detail}</TableCell>
                    <TableCell className="numeric tabular">{formatMoney(row.amount, currency)}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'VOID' ? 'destructive' : 'success'}>
                        {row.status === 'VOID' ? 'void' : 'posted'}
                      </Badge>
                    </TableCell>
                    <TableCell className="print:hidden">
                      {canTransact ? (
                        <DeleteButton
                          kind={row.kind}
                          id={row.id}
                          number={row.number}
                          variant="ghost"
                        />
                      ) : null}
                    </TableCell>
                  </ClickableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold">Reconciliations</h2>

      {reconciliations.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nothing reconciled yet. Reconciling proves the books and the bank agree about every item up
            to a date — and the difference, when there is one, is the size of what is missing.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="w-32">Statement date</TableHead>
                <TableHead className="numeric w-36">Closing balance</TableHead>
                <TableHead className="numeric w-24">Items</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliations.map((row) => (
                <ClickableRow
                  key={row.id}
                  href={`/banking/reconcile/${row.id}`}
                  title={`Open reconciliation for ${row.account.name}`}
                >
                  <TableCell>
                    {row.account.code} {row.account.name}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {formatDate(toCalendarDate(row.statementDate))}
                  </TableCell>
                  <TableCell className="numeric tabular">
                    {formatMoney(row.statementEndingBalance, currency)}
                  </TableCell>
                  <TableCell className="numeric tabular">{row._count.entries}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'COMPLETED' ? 'success' : 'warning'}>
                      {row.status === 'COMPLETED' ? 'Reconciled' : 'In progress'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/banking/reconcile/${row.id}`}
                      className="text-sm underline-offset-4 hover:underline"
                    >
                      {row.status === 'COMPLETED' ? 'View' : 'Continue'}
                    </Link>
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
