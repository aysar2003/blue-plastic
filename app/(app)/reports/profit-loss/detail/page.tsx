import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import {
  EXPENSE_COLOR,
  FigureChart,
  INCOME_COLOR,
  NET_COLOR,
  statementPicture,
} from '@/components/reports/figure-chart'
import { InteractiveGrid } from '@/components/data/interactive-grid'
import { Card } from '@/components/ui/card'
import { JOURNAL_SOURCE_LABELS } from '@/lib/accounting-labels'
import { formatDate, toDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { profitAndLoss } from '@/server/reports/statements'
import { resolveSources, sourceFor } from '@/server/services/journal-sources'
import { ReportControls } from '../../report-controls'
import { readSettings, type SearchParams } from '../../params'

export const metadata: Metadata = { title: 'Net income detail' }

/**
 * What Net income is made of: every income and expense movement in the period,
 * grouped by statement section, with each line opening the document behind it.
 */
export default async function ProfitAndLossDetailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const currency = ctx.organization.baseCurrency
  const back = `/reports/profit-loss?period=${settings.period}&from=${settings.range.from}&to=${settings.range.to}&basis=${settings.basis}`

  const report = await profitAndLoss(ctx.orgId, { ...settings.range, basis: settings.basis })
  const picture = statementPicture(report.sections, 'total')

  const lines = await db.journalLine.findMany({
    where: {
      orgId: ctx.orgId,
      journalDate: {
        gte: toDate(settings.range.from),
        lte: toDate(settings.range.to),
      },
      journal: {
        status: { notIn: ['DRAFT', 'DELETED'] },
        isClosingEntry: false,
      },
      account: { type: { in: ['REVENUE', 'EXPENSE'] } },
    },
    select: {
      id: true,
      debit: true,
      credit: true,
      description: true,
      journalDate: true,
      account: { select: { id: true, code: true, name: true, type: true, subtype: true } },
      journal: {
        select: {
          id: true,
          journalNumber: true,
          memo: true,
          sourceType: true,
          sourceId: true,
          postedAt: true,
        },
      },
      customer: { select: { displayName: true } },
      vendor: { select: { displayName: true } },
    },
    orderBy: [{ journalDate: 'asc' }, { lineNumber: 'asc' }],
    take: 800,
  })

  const sources = await resolveSources(
    ctx.orgId,
    lines.map((line) => ({ sourceType: line.journal.sourceType, sourceId: line.journal.sourceId })),
  )

  const byAccount = new Map<
    string,
    {
      accountId: string
      code: string
      name: string
      type: 'REVENUE' | 'EXPENSE'
      total: Decimal
      rows: {
        lineId: string
        recordedAt: string
        number: string
        label: string
        party: string | null
        href: string
        amount: string
      }[]
    }
  >()

  for (const line of lines) {
    const type = line.account.type === 'REVENUE' ? 'REVENUE' : 'EXPENSE'
    const debit = new Decimal(line.debit)
    const credit = new Decimal(line.credit)
    const amount = type === 'REVENUE' ? credit.minus(debit) : debit.minus(credit)
    const source = sourceFor(sources, {
      sourceType: line.journal.sourceType,
      sourceId: line.journal.sourceId,
    })
    const existing = byAccount.get(line.account.id) ?? {
      accountId: line.account.id,
      code: line.account.code,
      name: line.account.name,
      type,
      total: ZERO,
      rows: [],
    }
    existing.total = existing.total.plus(amount)
    existing.rows.push({
      lineId: line.id,
      recordedAt: line.journal.postedAt.toISOString(),
      number: source?.number ?? line.journal.journalNumber,
      label:
        JOURNAL_SOURCE_LABELS[line.journal.sourceType] ??
        line.journal.memo ??
        line.description ??
        'Journal',
      party: line.customer?.displayName ?? line.vendor?.displayName ?? source?.partyName ?? null,
      href: source?.href ?? `/journals/${line.journal.id}`,
      amount: amount.toString(),
    })
    byAccount.set(line.account.id, existing)
  }

  const sectionAccounts = report.sections.map((section) => ({
    key: section.key,
    label: section.label,
    total: section.total,
    accounts: section.rows
      .map((row) => byAccount.get(row.accountId))
      .filter((group): group is NonNullable<typeof group> => Boolean(group)),
  }))

  const orphanAccounts = [...byAccount.values()].filter(
    (group) => !report.sections.some((section) => section.rows.some((row) => row.accountId === group.accountId)),
  )

  return (
    <>
      <PageHeader
        title="Net income detail"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · every income and expense that built the profit`}
      />

      <p className="mb-3 text-sm">
        <Link href={back} className="font-medium text-primary underline-offset-4 hover:underline">
          Back to profit and loss
        </Link>
      </p>

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison="none"
        controls={{ mode: 'range', basis: true, exportAs: 'profit-loss' }}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <FigureChart
          caption="How the period landed"
          currency={currency}
          bars={[
            { label: 'Income', value: picture.income, color: INCOME_COLOR, href: '#income' },
            { label: 'Expenses', value: picture.expenses, color: EXPENSE_COLOR, href: '#expenses' },
            {
              label: 'Net income',
              value: picture.net,
              color: NET_COLOR,
              href: '#net-income',
            },
          ]}
        />

        <Card className="overflow-hidden border-0 bg-[linear-gradient(145deg,#0f3d4c_0%,#1a5c6e_45%,#e8f0f2_45.1%,#f4f7f8_100%)] p-0 shadow-sm ring-1 ring-slate-300/60">
          <div className="px-5 py-5 text-white">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-100/90">Net income</p>
            <p id="net-income" className="mt-2 text-3xl font-semibold tabular tracking-tight">
              {formatMoney(report.netIncome, currency)}
            </p>
            <p className="mt-2 max-w-sm text-sm text-teal-50/90">
              Income of {formatMoney(report.totalIncome, currency)} less costs and expenses in this
              period.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-slate-200/70 text-sm">
            <div className="bg-white/95 px-4 py-3">
              <dt className="text-xs text-muted-foreground">Gross profit</dt>
              <dd className="mt-0.5 font-semibold tabular">{formatMoney(report.grossProfit, currency)}</dd>
            </div>
            <div className="bg-white/95 px-4 py-3">
              <dt className="text-xs text-muted-foreground">Operating profit</dt>
              <dd className="mt-0.5 font-semibold tabular">
                {formatMoney(report.operatingProfit, currency)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="space-y-6">
        {sectionAccounts.map((section) => (
          <section
            key={section.key}
            id={section.key === 'income' || section.key === 'otherIncome' ? 'income' : section.key === 'cogs' || section.key === 'expenses' || section.key === 'otherExpense' ? 'expenses' : section.key}
            className="scroll-mt-20"
          >
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b bg-[#eef3f7] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-slate-900">{section.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    {section.accounts.length === 0
                      ? 'No movements in this section'
                      : `${section.accounts.reduce((n, a) => n + a.rows.length, 0)} lines across ${section.accounts.length} accounts`}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular text-slate-900">
                  {formatMoney(section.total, currency)}
                </p>
              </div>

              {section.accounts.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Nothing posted here in this period.</p>
              ) : (
                <div className="divide-y">
                  {section.accounts.map((account) => (
                    <details key={account.accountId} className="group open:bg-white" open={account.rows.length <= 12}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className="tabular text-muted-foreground">{account.code}</span>{' '}
                          <span className="font-medium text-slate-900">{account.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{account.rows.length} txn</span>
                        </span>
                        <span className="shrink-0 tabular font-medium">
                          {formatMoney(account.total, currency)}
                        </span>
                      </summary>
                      <div className="border-t bg-[#fbfcfd] p-2">
                        <InteractiveGrid
                          storageKey="bp-pl-detail-lines"
                          currency={currency}
                          timeZone={ctx.organization.timeZone}
                          columns={[
                            { id: 'date', label: 'Date', kind: 'datetime', defaultWidth: 188 },
                            { id: 'type', label: 'Type', defaultWidth: 148 },
                            { id: 'number', label: 'Number', defaultWidth: 128 },
                            { id: 'name', label: 'Name', defaultWidth: 180 },
                            { id: 'amount', label: 'Amount', kind: 'money', total: true, defaultWidth: 128 },
                          ]}
                          rows={account.rows.map((row) => ({
                            id: row.lineId,
                            cells: {
                              date: { value: row.recordedAt },
                              type: { value: row.label, href: row.href },
                              number: { value: row.number, href: row.href },
                              name: { value: row.party },
                              amount: { value: row.amount },
                            },
                          }))}
                        />
                        <p className="border-t px-4 py-2 text-xs">
                          <Link
                            href={`/reports/transaction-detail?account=${account.accountId}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=${encodeURIComponent('/reports/profit-loss/detail')}`}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            Open full transaction detail for {account.name}
                          </Link>
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Card>
          </section>
        ))}

        {orphanAccounts.length > 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            {orphanAccounts.length} further income/expense account
            {orphanAccounts.length === 1 ? '' : 's'} had movement outside the usual statement groups.
          </Card>
        ) : null}

        {lines.length >= 800 ? (
          <p className="text-sm text-muted-foreground">
            Showing the first 800 lines. Narrow the date range if you need every movement.
          </p>
        ) : null}
      </div>
    </>
  )
}
