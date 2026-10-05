import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ScrollTextIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { RegisterTable } from '@/components/accounts/register-table'
import {
  ACCOUNT_SUBTYPE_LABELS,
  ACCOUNT_TYPE_LABELS,
  isDebitNormalType,
  JOURNAL_SOURCE_LABELS,
} from '@/lib/accounting-labels'
import { fiscalYearOf, fiscalYearRange, formatDate, toCalendarDate, today } from '@/lib/date'
import { postedLineParts } from '@/lib/ledger-text'
import { formatMoney } from '@/lib/money'
import { readSort } from '@/components/data/sortable-header'
import { generalLedger } from '@/server/accounting/balances'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import { RegisterEntry } from '@/components/accounts/register-entry'
import { resolveSources, sourceFor } from '@/server/services/journal-sources'
import type { JournalSourceType } from '@prisma/client'

const SORTABLE = ['date', 'entry', 'description', 'debit', 'credit'] as const

export const metadata: Metadata = { title: 'Account' }

/**
 * The account register: every posted line, oldest first, with a running balance.
 * This is the drill-down behind every figure on every report — if a number looks
 * wrong, this is the page that shows why.
 */
export default async function AccountRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('account:read')
  const { id } = await params
  const query = await searchParams

  const account = await accountService.get(ctx, id).catch(() => null)
  if (!account) notFound()

  const timeZone = ctx.organization.timeZone
  const currency = ctx.organization.baseCurrency
  const defaults = fiscalYearRange(
    fiscalYearOf(today(timeZone), ctx.organization.fiscalYearStartMonth),
    ctx.organization.fiscalYearStartMonth,
  )
  const from = typeof query.from === 'string' ? query.from : defaults.start
  const to = typeof query.to === 'string' ? query.to : defaults.end

  const ledger = await generalLedger(ctx.orgId, id, { from, to })
  const canType =
    ctx.permissions.has('bank:transact') &&
    ['BANK', 'CREDIT_CARD', 'OTHER_CURRENT_ASSET', 'UNDEPOSITED_FUNDS'].includes(account.subtype)
  const categories = canType
    ? (await accountService.list(ctx))
        .filter((row) => row.type === 'EXPENSE' || row.type === 'REVENUE')
        .map((row) => ({ id: row.id, label: `${row.code} ${row.name}`, type: row.type }))
    : []

  // What produced each line, resolved in one batch per document family.
  //
  // This is the hop that makes a report answer its own question. A figure on the
  // profit and loss led here, and here used to lead only to the journal — so
  // tracing a number to the invoice that caused it took three screens, and the
  // middle one was the least informative of the three. The document and the
  // party it was with now sit on the register row itself.
  const sources = await resolveSources(
    ctx.orgId,
    ledger.entries.map((entry) => ({
      sourceType: entry.sourceType as JournalSourceType,
      sourceId: entry.sourceId,
    })),
  )

  // The running balance column only means anything in date order, so it is shown
  // as computed and never re-derived from a different ordering.
  const sort = readSort(query, SORTABLE, { sort: 'date', dir: 'asc' })
  const basePath = `/accounts/${id}`
  const linkParams = { from, to, sort: sort.sort, dir: sort.dir }
  const direction = sort.dir === 'asc' ? 1 : -1
  const entries = [...ledger.entries].sort((a, b) => {
    switch (sort.sort) {
      case 'entry':
        return direction * a.journalNumber.localeCompare(b.journalNumber)
      case 'description':
        return direction * (a.description ?? '').localeCompare(b.description ?? '')
      case 'debit':
        return direction * a.debit.comparedTo(b.debit)
      case 'credit':
        return direction * a.credit.comparedTo(b.credit)
      default:
        return direction * (a.date.getTime() - b.date.getTime())
    }
  })
  const debitNormal = isDebitNormalType(account.type)
  const balanceHeader =
    sort.sort === 'date' && sort.dir === 'asc' ? 'Balance' : 'Balance (in date order)'
  const registerRows = entries.map((entry) => {
    const source = sourceFor(sources, {
      sourceType: entry.sourceType as JournalSourceType,
      sourceId: entry.sourceId,
    })
    const sourceLabel = JOURNAL_SOURCE_LABELS[entry.sourceType as JournalSourceType] ?? entry.sourceType
    const parts = postedLineParts({
      sourceLabel,
      memo: entry.memo,
      description: entry.description,
      partyName: entry.partyName ?? source.partyName,
    })
    const nameHref = entry.customerId
      ? `/customers?id=${entry.customerId}`
      : entry.vendorId
        ? `/vendors?id=${entry.vendorId}`
        : source.partyHref
    return {
      lineId: entry.lineId,
      journalId: entry.journalId,
      journalNumber: entry.journalNumber,
      dateLabel: formatDate(toCalendarDate(entry.date)),
      status: entry.status,
      sourceLabel,
      name: parts.name,
      nameHref: nameHref ?? null,
      note: parts.note ?? null,
      docNumber: source.number,
      docHref: source.href,
      contraAccounts: entry.contraAccounts,
      splits: entry.splits.map((s) => ({ code: s.code, name: s.name, amount: s.amount })),
      debit: entry.debit.isZero() ? '' : entry.debit.toString(),
      credit: entry.credit.isZero() ? '' : entry.credit.toString(),
      balance: entry.balance.toString(),
    }
  })

  return (
    <>

      <PageHeader
        title={`${account.code} · ${account.name}`}
        description={`${ACCOUNT_TYPE_LABELS[account.type]} · ${ACCOUNT_SUBTYPE_LABELS[account.subtype]} · ${
          debitNormal ? 'debit' : 'credit'
        } balance`}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Summary label={`Opening ${formatDate(from)}`} value={formatMoney(ledger.opening, currency)} />
        <Summary
          label="Movement in range"
          value={formatMoney(ledger.closing.minus(ledger.opening), currency)}
        />
        <Summary label={`Closing ${formatDate(to)}`} value={formatMoney(ledger.closing, currency)} emphasis />
      </div>

      {account.description ? (
        <p className="mb-4 text-sm text-muted-foreground">{account.description}</p>
      ) : null}

      {canType ? (
        <RegisterEntry
          accountId={account.id}
          today={today(timeZone)}
          categories={categories}
        />
      ) : null}

      {ledger.entries.length === 0 ? (
        <EmptyState
          icon={ScrollTextIcon}
          title="Nothing posted to this account in this period"
          description={`Showing ${formatDate(from)} to ${formatDate(to)}.`}
        />
      ) : (
        <RegisterTable
          accountId={account.id}
          currency={currency}
          rows={registerRows}
          closingBalance={ledger.closing.toString()}
          sort={sort}
          basePath={basePath}
          linkParams={linkParams}
          balanceHeader={balanceHeader}
        />
      )}
    </>
  )
}

function Summary({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`tabular mt-0.5 ${emphasis ? 'text-lg font-semibold' : 'text-base'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
