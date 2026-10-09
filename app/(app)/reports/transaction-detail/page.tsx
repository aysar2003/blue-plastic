import type { Metadata } from 'next'
import { ScrollTextIcon } from 'lucide-react'
import type { JournalSourceType } from '@prisma/client'

import { EmptyState } from '@/components/data/empty-state'
import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'
import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent } from '@/components/ui/card'
import {
  ACCOUNT_SUBTYPE_LABELS,
  ACCOUNT_TYPE_LABELS,
  isDebitNormalType,
  JOURNAL_SOURCE_LABELS,
} from '@/lib/accounting-labels'
import { formatDate } from '@/lib/date'
import { postedLineParts } from '@/lib/ledger-text'
import { formatMoney } from '@/lib/money'
import { generalLedger } from '@/server/accounting/balances'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as accountService from '@/server/services/account.service'
import { resolveSources, sourceFor } from '@/server/services/journal-sources'
import { ReportControls } from '../report-controls'
import { readSettings, type SearchParams } from '../params'
import { AccountSwitcher } from './account-switcher'

export const metadata: Metadata = { title: 'Transaction Detail by Account' }

/**
 * Transaction detail by account.
 *
 * The page every figure on every report leads to, and the reason drill-down is
 * worth having: a number on a profit and loss is an aggregate, and the only
 * useful next question is *what is it made of*. This answers it in the terms the
 * question was asked in — every transaction that touched the account in the
 * period, dated, typed, numbered, named, with both sides and a running balance —
 * and every row opens the journal entry (with the source document linked
 * beside the journal number when one exists).
 *
 * So the whole chain is three clicks and never leaves the subject: profit and
 * loss → the sales account → the transactions in it → the journal. It used to
 * land on the chart-of-accounts register, which is a maintenance screen that
 * happens to list postings; the difference is what the page is *for*, and
 * therefore what it puts in front of you and what it lets you change.
 */
export default async function TransactionDetailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const currency = ctx.organization.baseCurrency

  const accountId = typeof query.account === 'string' ? query.account : undefined
  const chart = await accountService.selectableAccounts(ctx)

  if (!accountId) {
    return (
      <>
        <PageHeader
          title="Transaction Detail by Account"
          description="Every transaction that touched one account, with the document behind each."
        />
        <ReportControls
          period={settings.period}
          from={settings.range.from}
          to={settings.range.to}
          asOf={settings.asOf}
          basis={settings.basis}
          comparison={settings.comparison}
          controls={{ mode: 'range' }}
        />
        <Card>
          <CardContent className="p-4">
            <AccountSwitcher
              accounts={chart}
              value={null}
              from={settings.range.from}
              to={settings.range.to}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Choose an account, or reach this page by clicking a figure on the profit and loss,
              the balance sheet or the trial balance.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const account = await accountService.get(ctx, accountId).catch(() => null)
  if (!account) {
    return (
      <EmptyState
        icon={ScrollTextIcon}
        title="That account no longer exists"
        description="It may have been removed since the report was run."
      />
    )
  }

  const ledger = await generalLedger(ctx.orgId, accountId, settings.range)

  // What produced each line, in one batch per document family — so the number
  // cell can still offer the invoice beside the journal link.
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

  const debitNormal = isDebitNormalType(account.type)
  const movement = ledger.closing.minus(ledger.opening)
  const splitAccounts = new Map<string, { code: string; name: string }>()
  for (const entry of ledger.entries) {
    for (const split of entry.splits) {
      if (!splitAccounts.has(split.code)) splitAccounts.set(split.code, { code: split.code, name: split.name })
    }
  }
  const splitList = [...splitAccounts.values()].sort((a, b) => a.code.localeCompare(b.code))
  const columns: InteractiveColumn[] = [
    { id: 'date', label: 'Date', kind: 'datetime', defaultWidth: 188 },
    { id: 'type', label: 'Type', defaultWidth: 148 },
    { id: 'number', label: 'Number', defaultWidth: 132 },
    { id: 'name', label: 'Name', defaultWidth: 168 },
    { id: 'memo', label: 'Memo', defaultWidth: 220 },
    ...splitList.map((split) => ({
      id: `split:${split.code}`,
      label: split.name,
      kind: 'money' as const,
      total: true,
      defaultWidth: 150,
    })),
    { id: 'debit', label: 'Debit', kind: 'money', total: true, defaultWidth: 120 },
    { id: 'credit', label: 'Credit', kind: 'money', total: true, defaultWidth: 120 },
    { id: 'balance', label: 'Balance', kind: 'money', total: false, defaultWidth: 136 },
  ]

  return (
    <>

      <PageHeader
        title="Transaction Detail by Account"
        description={`${account.code} · ${account.name} — ${ACCOUNT_TYPE_LABELS[account.type]} · ${
          ACCOUNT_SUBTYPE_LABELS[account.subtype]
        } · ${debitNormal ? 'debit' : 'credit'} balance`}
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range' }}
      />

      <div className="mb-4">
        <AccountSwitcher
          accounts={chart}
          value={accountId}
          from={settings.range.from}
          to={settings.range.to}
        />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Summary
          label={`Balance at ${formatDate(settings.range.from)}`}
          value={formatMoney(ledger.opening, currency)}
        />
        <Summary label="Movement in this period" value={formatMoney(movement, currency)} />
        <Summary
          label={`Balance at ${formatDate(settings.range.to)}`}
          value={formatMoney(ledger.closing, currency)}
          emphasis
        />
      </div>

      {ledger.entries.length === 0 ? (
        <EmptyState
          icon={ScrollTextIcon}
          title="Nothing touched this account in this period"
          description={`Showing ${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}. Widen the dates, or pick another account.`}
        />
      ) : (
        <InteractiveGrid
          storageKey={`bp-txn-detail-${accountId}`}
          columns={columns}
          rows={ledger.entries.map((entry): InteractiveRow => {
            const source = sourceFor(sources, {
              sourceType: entry.sourceType as JournalSourceType,
              sourceId: entry.sourceId,
            })
            // The row's Type opens the journal entry; Number offers the source
            // document when there is one, falling back to the journal.
            const journalHref = `/journals/${entry.journalId}`
            const docHref = source.href ?? null
            const docNumber = source.number ?? null
            const baseLabel =
              JOURNAL_SOURCE_LABELS[entry.sourceType as JournalSourceType] ?? entry.sourceType
            const posRegister =
              (entry.sourceType === 'SALES_RECEIPT' || entry.sourceType === 'REFUND_RECEIPT') &&
              entry.sourceId
                ? (posByDoc.get(entry.sourceId) ?? null)
                : null
            const typeLabel = posRegister ? `${baseLabel} (POS)` : baseLabel
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
            const cells: InteractiveRow['cells'] = {
              date: { value: entry.recordedAt.toISOString() },
              type: { value: typeLabel, href: journalHref },
              number: {
                value: docNumber ?? entry.journalNumber,
                href: docHref ?? journalHref,
                badge: entry.status === 'REVERSED' ? 'reversed' : null,
              },
              name: parts.name ? { value: parts.name, href: nameHref } : { value: null },
              memo: { value: parts.note },
              debit: { value: entry.debit.isZero() ? null : entry.debit.toString() },
              credit: { value: entry.credit.isZero() ? null : entry.credit.toString() },
              balance: { value: entry.balance.toString() },
            }
            for (const split of splitList) {
              const amount = entry.splits.find((item) => item.code === split.code)?.amount
              cells[`split:${split.code}`] = amount && Number(amount) !== 0 ? { value: amount } : { value: null }
            }
            return { id: entry.lineId, cells }
          })}
          currency={currency}
          timeZone={ctx.organization.timeZone}
          customizable
          totalLabel="Total"
          footers={[
            {
              id: 'closing',
              label: 'Closing balance',
              cells: { balance: { value: ledger.closing.toString() } },
            },
          ]}
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
