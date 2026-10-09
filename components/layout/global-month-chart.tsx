'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3Icon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import {
  EXPENSE_COLOR,
  FigureChart,
  INCOME_COLOR,
  NET_COLOR,
} from '@/components/reports/figure-chart'
import { money } from '@/lib/money'

export type MonthChartData = {
  caption: string
  currency: string
  income: string
  expenses: string
  net: string
  openInvoices: number
}

/** Explicit show only — default is hidden everywhere outside Reports. */
const STORAGE_KEY = 'bp.month-chart.visible'

function isReportPath(pathname: string) {
  return pathname === '/reports' || pathname.startsWith('/reports/')
}

/** Live till / print — do not steal space from selling or paper. */
function hideOnPath(pathname: string) {
  if (isReportPath(pathname)) return true
  if (pathname.endsWith('/print') || pathname.includes('/display') || pathname.includes('/lock')) {
    return true
  }
  if (!pathname.startsWith('/pos')) return false
  const segments = pathname.split('/').filter(Boolean)
  const hubs = new Set(['orders', 'quotations', 'sessions', 'settings'])
  return segments.length === 2 && segments[0] === 'pos' && !hubs.has(segments[1]!)
}

/**
 * Optional this-month chart for non-report screens.
 * Stays hidden until someone taps Show — reports keep their own charts.
 */
export function GlobalMonthChart({ data }: { data: MonthChartData | null }) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) === '1')
    setReady(true)
  }, [])

  if (!data || hideOnPath(pathname)) return null

  function toggle() {
    setVisible((current) => {
      const next = !current
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  if (!ready || !visible) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-card/80 px-4 py-1.5 print:hidden sm:px-6">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <BarChart3Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{data.caption}</span>
        </p>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          Show chart
          <ChevronDownIcon className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  const pnlHref = '/reports/profit-loss?period=this-month'
  const detailHref = '/reports/profit-loss/detail?period=this-month'

  return (
    <div className="border-b border-border/70 bg-card/90 px-4 py-3 print:hidden sm:px-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Books this month</p>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          Hide chart
          <ChevronUpIcon className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <FigureChart
          caption={data.caption}
          currency={data.currency}
          bars={[
            {
              label: 'Income',
              value: money(data.income),
              color: INCOME_COLOR,
              href: pnlHref,
            },
            {
              label: 'Expenses',
              value: money(data.expenses),
              color: EXPENSE_COLOR,
              href: pnlHref,
            },
            {
              label: 'Net income',
              value: money(data.net),
              color: NET_COLOR,
              href: detailHref,
            },
          ]}
        />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          <Link href={pnlHref} className="font-medium text-primary underline-offset-4 hover:underline">
            Profit and loss
          </Link>
          <span className="mx-1.5 opacity-40">·</span>
          <Link
            href="/reports/balance-sheet"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Balance sheet
          </Link>
          {data.openInvoices > 0 ? (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              <Link
                href="/sales/invoices?status=open"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {data.openInvoices} open invoice{data.openInvoices === 1 ? '' : 's'}
              </Link>
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}
