'use client'

import { useMemo } from 'react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import Link from 'next/link'

const KEY = 'bp-home-widgets'
const ALL = ['in', 'out', 'due', 'banks'] as const
type Key = (typeof ALL)[number]

export function HomeWidgets({
  moneyIn,
  moneyOut,
  invoicesDue,
  invoiceCount,
  banks,
  period,
}: {
  moneyIn: string
  moneyOut: string
  invoicesDue: string
  invoiceCount: number
  banks: { id: string; name: string; balance: string }[]
  period: string
}) {
  const stored = useBrowserStore(KEY)
  const shown = useMemo(() => {
    if (!stored) return [...ALL]
    try {
      const parsed = JSON.parse(stored) as Key[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      /* keep the defaults */
    }
    return [...ALL]
  }, [stored])

  function toggle(key: Key) {
    const next = shown.includes(key) ? shown.filter((item) => item !== key) : [...shown, key]
    const value = next.length === 0 ? [...ALL] : next
    writeBrowserStore(KEY, JSON.stringify(value))
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-primary">This month · {period}</h2>
        {ALL.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              shown.includes(key) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
            }`}
          >
            {key === 'in' ? 'Money in' : key === 'out' ? 'Money out' : key === 'due' ? 'Invoices' : 'Banks'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shown.includes('in') ? <Tile label="Money in" value={moneyIn} href="/reports/profit-loss" /> : null}
        {shown.includes('out') ? <Tile label="Money out" value={moneyOut} href="/reports/profit-loss" /> : null}
        {shown.includes('due') ? (
          <Tile label="Invoices still open" value={invoicesDue} hint={`${invoiceCount} open`} href="/sales/invoices" />
        ) : null}
        {shown.includes('banks') ? (
          <div className="rounded-xl border border-primary/15 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-medium text-primary">Bank balances</p>
            <ul className="mt-2 space-y-1">
              {banks.length === 0 ? <li className="text-sm text-muted-foreground">No bank accounts yet.</li> : null}
              {banks.map((bank) => (
                <li key={bank.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <Link href={`/accounts/${bank.id}`} className="truncate hover:underline">
                    {bank.name}
                  </Link>
                  <span className="tabular font-medium">{bank.balance}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Tile({ label, value, href, hint }: { label: string; value: string; href: string; hint?: string }) {
  return (
    <Link href={href} className="rounded-xl border border-primary/15 bg-white/80 p-4 shadow-sm transition-colors hover:border-primary/40">
      <p className="text-xs font-medium text-primary">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  )
}
