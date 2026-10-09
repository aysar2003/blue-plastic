import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ScrollTextIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { DateRangeForm } from '@/app/(app)/reports/trial-balance/date-range-form'
import { Card, CardContent } from '@/components/ui/card'
import { RegisterTable } from '@/components/accounts/register-table'
import {
  ACCOUNT_SUBTYPE_LABELS,
  ACCOUNT_TYPE_LABELS,
  isDebitNormalType,
  JOURNAL_SOURCE_LABELS,
} from '@/lib/accounting-labels'
import { fiscalYearOf, fiscalYearRange, formatDate, today } from '@/lib/date'
import { postedLineParts } from '@/lib/ledger-text'
import { formatMoney } from '@/lib/money'
import { generalLedger } from '@/server/accounting/balances'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as accountService from '@/server/services/account.service'
import { RegisterEntry } from '@/components/accounts/register-entry'
import { resolveSources, sourceFor } from '@/server/services/journal-sources'
import type { JournalSourceType } from '@prisma/client'

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
  const sourceFilter =
    query.source === 'pos' || query.source === 'other' ? query.source : ''

  const ledger = await generalLedger(ctx.orgId, id, { from, to })
  const canType =
    ctx.permissions.has('bank:transact') &&
    ['BANK', 'CREDIT_CARD', 'OTHER_CURRENT_ASSET', 'UNDEPOSITED_FUNDS'].includes(account.subtype)
  const categories = canType
    ? (await accountService.list(ctx))
        .filter((row) => row.type === 'EXPENSE' || row.type === 'REVENUE')
        .map((row) => ({ id: row.id, label: `${row.code} ${row.name}`, type: row.type }))
    : []

  const sources = await resolveSources(
    ctx.orgId,
    ledger.entries.map((entry) => ({
      sourceType: entry.sourceType as JournalSourceType,
      sourceId: entry.sourceId,
    })),
  )

  const salesDocIds = [
    ...new Set(
      ledger.entries
        .filter(
          (entry) =>
            (entry.sourceType === 'SALES_RECEIPT' || entry.sourceType === 'REFUND_RECEIPT') &&
            entry.sourceId,
        )
        .map((entry) => entry.sourceId as string),
    ),
  ]
  const posOrders =
    salesDocIds.length > 0
      ? await db.posOrder.findMany({
          where: { orgId: ctx.orgId, salesDocumentId: { in: salesDocIds } },
          select: {
            salesDocumentId: true,
            register: { select: { name: true } },
          },
        })
      : []
  const posByDoc = new Map(posOrders.map((order) => [order.salesDocumentId, order.register.name]))

  // The grid sorts for display on its own; the balance column keeps the value
  // computed in journal-date order no matter how the reader re-sorts the rows.
  const debitNormal = isDebitNormalType(account.type)
  const registerRows = ledger.entries
    .map((entry) => {
      const source = sourceFor(sources, {
        sourceType: entry.sourceType as JournalSourceType,
        sourceId: entry.sourceId,
      })
      const posRegister =
        (entry.sourceType === 'SALES_RECEIPT' || entry.sourceType === 'REFUND_RECEIPT') &&
        entry.sourceId
          ? (posByDoc.get(entry.sourceId) ?? null)
          : null
      const baseLabel =
        JOURNAL_SOURCE_LABELS[entry.sourceType as JournalSourceType] ?? entry.sourceType
      // Keep the plain journal label for memo parsing; TYPE shows "(POS)" when till-sold.
      const sourceLabel = posRegister ? `${baseLabel} (POS)` : baseLabel
      const parts = postedLineParts({
        sourceLabel: baseLabel,
        memo: entry.memo,
        description: entry.description,
        partyName: entry.partyName ?? source.partyName,
      })
      const nameHref = entry.customerId
        ? `/customers?id=${entry.customerId}`
        : entry.vendorId
          ? `/vendors?id=${entry.vendorId}`
          : source.partyHref
      const documentHref = source.href ?? `/journals/${entry.journalId}`
      return {
        lineId: entry.lineId,
        journalNumber: entry.journalNumber,
        recordedAt: entry.recordedAt.toISOString(),
        status: entry.status,
        sourceLabel,
        typeHref: documentHref,
        entryHref: documentHref,
        posRegisterName: posRegister,
        isPos: Boolean(posRegister),
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
    .filter((row) => {
      if (sourceFilter === 'pos') return row.isPos
      if (sourceFilter === 'other') return !row.isPos
      return true
    })

  function sourceHref(value: '' | 'pos' | 'other') {
    const search = new URLSearchParams()
    search.set('from', from)
    search.set('to', to)
    if (value) search.set('source', value)
    return `/accounts/${id}?${search.toString()}`
  }

  return (
    <>
      <PageHeader
        title={`${account.code} · ${account.name}`}
        description={`${ACCOUNT_TYPE_LABELS[account.type]} · ${ACCOUNT_SUBTYPE_LABELS[account.subtype]} · ${
          debitNormal ? 'debit' : 'credit'
        } balance`}
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <DateRangeForm
          from={from}
          to={to}
          extraParams={{
            source: sourceFilter || undefined,
          }}
        />
        <div className="flex flex-wrap gap-1 pb-0.5">
          <FilterChip href={sourceHref('')} active={!sourceFilter} label="All sources" />
          <FilterChip href={sourceHref('pos')} active={sourceFilter === 'pos'} label="POS only" />
          <FilterChip href={sourceHref('other')} active={sourceFilter === 'other'} label="Not POS" />
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Summary label={`Opening ${formatDate(from)}`} value={formatMoney(ledger.opening, currency)} />
        <Summary
          label="Movement in range"
          value={formatMoney(ledger.closing.minus(ledger.opening), currency)}
        />
        <Summary label={`Closing ${formatDate(to)}`} value={formatMoney(ledger.closing, currency)} emphasis />
      </div>

      {account.description && account.description !== 'pos-parent' && !account.description.startsWith('pos-register:') ? (
        <p className="mb-4 text-sm text-muted-foreground">{account.description}</p>
      ) : null}

      {canType ? (
        <RegisterEntry
          accountId={account.id}
          today={today(timeZone)}
          categories={categories}
        />
      ) : null}

      {registerRows.length === 0 ? (
        <EmptyState
          icon={ScrollTextIcon}
          title="Nothing posted to this account in this period"
          description={`Showing ${formatDate(from)} to ${formatDate(to)}${
            sourceFilter === 'pos' ? ' · POS only' : sourceFilter === 'other' ? ' · not POS' : ''
          }.`}
        />
      ) : (
        <RegisterTable
          accountId={account.id}
          currency={currency}
          timeZone={timeZone}
          rows={registerRows}
          closingBalance={ledger.closing.toString()}
        />
      )}
    </>
  )
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
          : 'rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
      }
    >
      {label}
    </Link>
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
