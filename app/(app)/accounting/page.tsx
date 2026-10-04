import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpenIcon, CalendarRangeIcon, ReceiptIcon } from 'lucide-react'

import { StatementTable } from '@/components/reports/statement-table'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { profitAndLoss } from '@/server/reports/statements'
import { ReportControls } from '../reports/report-controls'
import { readSettings, type SearchParams } from '../reports/params'

export const metadata: Metadata = { title: 'Overview' }

/**
 * Accounting's front door: a profit and loss you can filter, then the three
 * places the books open from, drawn as the same coloured tiles as Home.
 */
export default async function AccountingHubPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('account:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization, 'this-month')
  const currency = ctx.organization.baseCurrency

  const [accounts, openPeriods, openInvoices, report] = await Promise.all([
    db.ledgerAccount.count({ where: { orgId: ctx.orgId, isActive: true } }),
    db.accountingPeriod.count({ where: { orgId: ctx.orgId, status: 'OPEN' } }),
    db.salesDocument.count({
      where: { orgId: ctx.orgId, type: 'INVOICE', status: { in: ['OPEN', 'PARTIAL'] } },
    }),
    profitAndLoss(ctx.orgId, { ...settings.range, basis: settings.basis }),
  ])

  const drill = (accountId: string) =>
    `/reports/transaction-detail?account=${accountId}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=/accounting`

  return (
    <div className="w-full px-[clamp(0.75rem,2vw,2.5rem)] py-6">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{ctx.organization.name}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Overview</h1>
      <p className="mt-1 text-sm text-slate-600">
        {formatDate(settings.range.from)} to {formatDate(settings.range.to)} ·{' '}
        {settings.basis === 'cash' ? 'cash basis' : 'accrual basis'}
      </p>

      <div className="mt-4">
        <ReportControls
          period={settings.period}
          from={settings.range.from}
          to={settings.range.to}
          asOf={settings.asOf}
          basis={settings.basis}
          comparison="none"
          controls={{ mode: 'range', basis: true }}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <StatementTable
            sections={report.sections}
            currency={currency}
            drillTo={drill}
            subtotals={{
              cogs: [{ label: 'Gross profit', amount: report.grossProfit }],
              expenses: [{ label: 'Operating profit', amount: report.operatingProfit }],
              otherExpense: [{ label: 'Net income', amount: report.netIncome, emphasis: true }],
            }}
          />
        </div>
      </Card>

      <ul className="mt-8 grid grid-cols-3 gap-x-4 gap-y-8 sm:max-w-xl">
        <OverviewTile
          href="/accounts"
          label="Accounts"
          blurb={`${accounts} on the chart`}
          accent="#0F766E"
          wash="#CCFBF1"
          icon="book"
        />
        <OverviewTile
          href="/periods"
          label="Open periods"
          blurb={`${openPeriods} still open`}
          accent="#C2410C"
          wash="#FFEDD5"
          icon="calendar"
        />
        <OverviewTile
          href="/sales/invoices"
          label="Open invoices"
          blurb={`${openInvoices} not settled`}
          accent="#0369A1"
          wash="#E0F2FE"
          icon="receipt"
        />
      </ul>
    </div>
  )
}

function OverviewTile({
  href,
  label,
  blurb,
  accent,
  wash,
  icon,
}: {
  href: string
  label: string
  blurb: string
  accent: string
  wash: string
  icon: 'book' | 'calendar' | 'receipt'
}) {
  const Icon = icon === 'book' ? BookOpenIcon : icon === 'calendar' ? CalendarRangeIcon : ReceiptIcon
  return (
    <li>
      <Link href={href} className="group flex flex-col items-center gap-2.5">
        <span className="grid size-[4.5rem] place-items-center rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5 transition duration-200 group-hover:-translate-y-1">
          <span className="grid size-11 place-items-center rounded-xl" style={{ backgroundColor: wash, color: accent }}>
            <Icon className="size-6" strokeWidth={1.75} aria-hidden />
          </span>
        </span>
        <span className="max-w-[8rem] text-center">
          <span className="block text-[0.8125rem] font-medium leading-snug text-slate-700 group-hover:text-slate-950">
            {label}
          </span>
          <span className="mt-0.5 block text-[0.6875rem] leading-snug text-slate-400">{blurb}</span>
        </span>
      </Link>
    </li>
  )
}
