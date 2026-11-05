'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { formatMoney } from '@/lib/money'
import { customerOpenBalancePanel } from '@/app/(app)/sales/actions'

type RecentRow = {
  id: string
  kind: 'INVOICE' | 'PAYMENT' | 'CREDIT_MEMO'
  number: string
  date: string
  amount: string
  href: string
}

type PanelData = {
  openBalance: string
  estimatesOpen: number
  recent: RecentRow[]
  statementHref: string
}

/**
 * QuickBooks-style customer strip: open balance plus recent invoices / payments
 * so the figure is explained by the same trail that built it.
 */
export function CustomerBalancePanel({
  customerId,
  currency,
  className,
}: {
  customerId: string | null
  currency: string
  className?: string
}) {
  const [data, setData] = useState<PanelData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customerId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void customerOpenBalancePanel({ customerId })
      .then((result) => {
        if (!cancelled) setData(result.ok ? result.data : null)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  if (!customerId) {
    return (
      <aside className={className}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
        <p className="mt-2 text-sm text-muted-foreground">Choose a customer to see open balance.</p>
      </aside>
    )
  }

  return (
    <aside className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Open balance</dt>
          <dd className="tabular font-semibold">
            {loading || !data ? '…' : formatMoney(data.openBalance, currency)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Active estimates</dt>
          <dd className="tabular">{loading || !data ? '…' : data.estimatesOpen}</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recent transactions
      </p>
      {loading || !data ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : data.recent.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No recent activity.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {data.recent.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="flex items-baseline justify-between gap-2">
              <Link href={row.href} className="min-w-0 truncate text-muted-foreground hover:underline">
                <span className="tabular">{row.date}</span>{' '}
                <span className="text-foreground">
                  {row.kind === 'PAYMENT' ? 'Payment' : row.kind === 'CREDIT_MEMO' ? 'Credit' : 'Invoice'}{' '}
                  {row.number}
                </span>
              </Link>
              <span className="shrink-0 tabular">{formatMoney(row.amount, currency)}</span>
            </li>
          ))}
        </ul>
      )}

      {data ? (
        <p className="mt-3 text-xs">
          <Link href={data.statementHref} className="text-primary underline-offset-4 hover:underline">
            Full statement — how this balance is built
          </Link>
        </p>
      ) : null}
    </aside>
  )
}
