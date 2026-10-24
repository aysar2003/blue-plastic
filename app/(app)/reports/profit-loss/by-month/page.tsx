import type { Metadata } from 'next'

import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { InteractiveGrid } from '@/components/data/interactive-grid'
import { PageHeader } from '@/components/data/page-header'
import { endOfMonth, today } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { profitAndLoss, type ProfitAndLoss } from '@/server/reports/statements'

export const metadata: Metadata = { title: 'Profit and Loss by Month' }

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

type MonthKey = `m${number}`

/**
 * QBD-style columnar P&L: accounts down the side, months across the top.
 * Each month is read from the ledger on its own so figures never come from a stored rollup.
 */
export default async function ProfitAndLossByMonthPage() {
  const ctx = await requireOrgContext('report:read')
  const now = today(ctx.organization.timeZone)
  const year = now.slice(0, 4)
  const currency = ctx.organization.baseCurrency

  const reports = await Promise.all(
    MONTHS.map((_, index) => {
      const from = `${year}-${String(index + 1).padStart(2, '0')}-01`
      return profitAndLoss(ctx.orgId, { from, to: endOfMonth(from), basis: 'accrual' })
    }),
  )

  const { columns, rows } = buildColumnar(reports)

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Profit and Loss by Month"
        description={`Accrual basis for ${year}. Accounts as rows, months as columns — each month from the ledger.`}
        actions={
          <PrintButton
            paper="profit and loss by month"
            defaultSubject={`Profit and Loss by Month — ${ctx.organization.name}`}
            defaultBody={`Profit and Loss by Month\n${ctx.organization.name}\n${year}`}
          />
        }
      />
      <InteractiveGrid
        storageKey="bp-pl-by-month-columns"
        currency={currency}
        columns={columns}
        rows={rows}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Section totals, gross profit, and net income are included. A blank month cell means no
        postings to that account in the month.
      </p>
    </>
  )
}

function buildColumnar(reports: ProfitAndLoss[]) {
  const monthKeys = MONTHS.map((_, index) => `m${index}` as MonthKey)

  const columns = [
    { id: 'account', label: 'Account', defaultWidth: 220 },
    ...MONTHS.map((label, index) => ({
      id: monthKeys[index]!,
      label: label.slice(0, 3),
      kind: 'money' as const,
      total: false,
      defaultWidth: 100,
    })),
    { id: 'total', label: 'Total', kind: 'money' as const, total: false, defaultWidth: 120 },
  ]

  type GridRow = {
    id: string
    emphasis?: boolean
    excludeFromTotal?: boolean
    className?: string
    cells: Record<string, { value: string | null; sort?: string }>
  }

  const rows: GridRow[] = []
  let sort = 0

  const pushLabel = (id: string, label: string, emphasis = false) => {
    rows.push({
      id,
      emphasis,
      excludeFromTotal: true,
      className: emphasis ? 'bg-muted/40 font-medium' : undefined,
      cells: {
        account: { value: label, sort: String(sort++).padStart(4, '0') },
        ...Object.fromEntries(monthKeys.map((key) => [key, { value: null }])),
        total: { value: null },
      },
    })
  }

  const pushMoneyRow = (
    id: string,
    label: string,
    amounts: Decimal[],
    options?: { emphasis?: boolean },
  ) => {
    const yearTotal = amounts.reduce((sum, value) => sum.plus(value), ZERO)
    rows.push({
      id,
      emphasis: options?.emphasis,
      excludeFromTotal: true,
      className: options?.emphasis ? 'bg-muted/40 font-medium' : undefined,
      cells: {
        account: { value: label, sort: String(sort++).padStart(4, '0') },
        ...Object.fromEntries(
          monthKeys.map((key, index) => [
            key,
            { value: amounts[index]?.isZero() ? null : amounts[index]!.toString() },
          ]),
        ),
        total: { value: yearTotal.isZero() ? null : yearTotal.toString() },
      },
    })
  }

  const sectionKeys = [
    { key: 'income', label: 'Income' },
    { key: 'cogs', label: 'Cost of goods sold' },
    { key: 'expenses', label: 'Operating expenses' },
    { key: 'otherIncome', label: 'Other income' },
    { key: 'otherExpense', label: 'Other expenses' },
  ] as const

  for (const section of sectionKeys) {
    const accountIds = new Map<string, { code: string; name: string }>()
    for (const report of reports) {
      const found = report.sections.find((row) => row.key === section.key)
      for (const account of found?.rows ?? []) {
        if (!accountIds.has(account.accountId)) {
          accountIds.set(account.accountId, { code: account.code, name: account.name })
        }
      }
    }

    if (accountIds.size === 0) continue

    pushLabel(`section-${section.key}`, section.label, true)

    for (const [accountId, meta] of accountIds) {
      const amounts = reports.map((report) => {
        const found = report.sections.find((row) => row.key === section.key)
        const account = found?.rows.find((row) => row.accountId === accountId)
        return account?.amount ?? ZERO
      })
      pushMoneyRow(`acct-${accountId}`, `${meta.code} · ${meta.name}`, amounts)
    }

    pushMoneyRow(
      `total-${section.key}`,
      `Total ${section.label.toLowerCase()}`,
      reports.map((report) => report.sections.find((row) => row.key === section.key)?.total ?? ZERO),
      { emphasis: true },
    )

    if (section.key === 'cogs') {
      pushMoneyRow(
        'gross-profit',
        'Gross profit',
        reports.map((report) => report.grossProfit),
        { emphasis: true },
      )
    }
    if (section.key === 'expenses') {
      pushMoneyRow(
        'operating-profit',
        'Operating profit',
        reports.map((report) => report.operatingProfit),
        { emphasis: true },
      )
    }
  }

  pushMoneyRow(
    'net-income',
    'Net income',
    reports.map((report) => report.netIncome),
    { emphasis: true },
  )

  return { columns, rows }
}
