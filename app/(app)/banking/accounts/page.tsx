import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeftRightIcon, BanknoteIcon, UploadIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { StartReconciliationButton } from '@/components/banking/start-reconciliation'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DeleteButton } from '@/components/data/delete-record'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { requireOrgContext } from '@/server/auth/context'
import * as bankingService from '@/server/services/banking.service'
import { history } from '@/server/services/reconciliation.service'

const SORTABLE = ['name', 'books', 'bank', 'pending'] as const

export const metadata: Metadata = { title: 'Bank accounts' }

export default async function BankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bank:read')
  const sort = readSort(await searchParams, SORTABLE, { sort: 'name', dir: 'asc' })

  const [allAccounts, reconciliations, transfers, deposits] = await Promise.all([
    bankingService.bankAccounts(ctx),
    history(ctx),
    bankingService.listTransfers(ctx, { page: 1, pageSize: 50_000, dir: 'desc' }),
    bankingService.listDeposits(ctx, { page: 1, pageSize: 50_000, dir: 'desc' }),
  ])

  // Balances are computed from the ledger, so the ordering is applied here.
  const direction = sort.dir === 'asc' ? 1 : -1
  const accounts = [...allAccounts].sort((a, b) => {
    switch (sort.sort) {
      case 'books':
        return direction * a.balance.comparedTo(b.balance)
      case 'bank':
        return direction * a.cleared.comparedTo(b.cleared)
      case 'pending':
        return direction * a.uncleared.comparedTo(b.uncleared)
      default:
        return direction * a.code.localeCompare(b.code)
    }
  })

  const currency = ctx.organization.baseCurrency
  const canTransact = ctx.permissions.has('bank:transact')
  const canReconcile = ctx.permissions.has('bank:reconcile')

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every account money passes through, what the books say it holds, and how much of that the bank has already confirmed."
        actions={
          <>
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
          title="No bank accounts yet"
          description="Add a bank or credit card account to the chart of accounts, and it will appear here."
        />
      ) : (
        <Card className="mb-6 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="name" label="Account" state={sort} basePath="/banking/accounts" />
                <SortableHeader column="books" label="In the books" state={sort} basePath="/banking/accounts" className="w-40" numeric defaultDirection="desc" />
                <SortableHeader column="bank" label="Confirmed by the bank" state={sort} basePath="/banking/accounts" className="w-40" numeric defaultDirection="desc" />
                <SortableHeader column="pending" label="Not yet confirmed" state={sort} basePath="/banking/accounts" className="w-40" numeric defaultDirection="desc" />
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <Link
                      href={`/accounts/${account.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      <span className="tabular text-muted-foreground">{account.code}</span> {account.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {account.subtype === 'CREDIT_CARD'
                        ? 'Credit card'
                        : account.subtype === 'UNDEPOSITED_FUNDS'
                          ? 'Money in hand, not yet banked'
                          : 'Bank'}
                    </span>
                  </TableCell>
                  <TableCell className="numeric tabular font-medium">
                    {formatMoney(account.balance, currency)}
                  </TableCell>
                  <TableCell className="numeric tabular text-muted-foreground">
                    {formatMoney(account.cleared, currency)}
                  </TableCell>
                  <TableCell className="numeric tabular text-muted-foreground">
                    {account.uncleared.isZero() ? '—' : formatMoney(account.uncleared, currency)}
                  </TableCell>
                  <TableCell>
                    {canReconcile && account.subtype !== 'UNDEPOSITED_FUNDS' ? (
                      <StartReconciliationButton
                        accountId={account.id}
                        accountName={account.name}
                        today={today(ctx.organization.timeZone)}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
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
      <h2 id="transfers" className="mb-3 scroll-mt-20 text-sm font-semibold">Transfers and deposits</h2>

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
                  <TableRow key={`${row.kind}-${row.id}`}>
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
                  </TableRow>
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
                <TableRow key={row.id}>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
