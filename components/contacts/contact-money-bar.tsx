'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export type MoneyBarBand = {
  key: string
  amount: string
  detail: string
  /** Precomputed filter href - must be a string (not a function) for the client boundary. */
  href: string
  /** Tailwind classes for the coloured segment and accent. */
  bar: string
  /** Optional text colour for the amount when selected / emphasised. */
  accent?: string
}

/**
 * QuickBooks-style money strip above the customer / vendor list.
 * Click a band to filter the list; the chevron collapses the whole strip.
 */
export function ContactMoneyBar({
  bands,
  currency,
  active,
  storageKey,
}: {
  bands: MoneyBarBand[]
  currency: string
  active?: string
  storageKey: string
}) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored === '0') setOpen(false)
      if (stored === '1') setOpen(true)
    } catch {
      /* keep default */
    }
  }, [storageKey])

  function toggle() {
    setOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const total = bands.reduce((sum, band) => sum.plus(new Decimal(band.amount).abs()), new Decimal(0))

  if (!open) {
    return (
      <div className="flex items-center justify-end border-b bg-[#f4f8fb] px-3 py-1">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-white hover:text-foreground"
          aria-expanded={false}
          aria-label="Show money summary"
        >
          Show summary
          <ChevronDownIcon className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative border-b bg-[#f4f8fb] px-5 pb-3 pt-4">
      <div className={cn('grid gap-4', bands.length >= 5 ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4')}>
        {bands.map((band) => {
          const selected = active === band.key
          return (
            <Link
              key={band.key}
              href={band.href}
              className={cn('rounded-md px-1 py-1 transition-colors', selected && 'bg-white shadow-sm ring-1 ring-border')}
              aria-current={selected ? 'true' : undefined}
            >
              <p
                className={cn(
                  'tabular text-xl font-medium leading-none tracking-tight sm:text-2xl',
                  band.accent && selected ? band.accent : 'text-foreground',
                )}
              >
                {formatMoney(band.amount, currency)}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className={cn('font-medium', band.key === 'overdue' && 'text-[#d4652f]')}>
                  {band.detail}
                </span>
              </p>
            </Link>
          )
        })}
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-sm bg-[#e7edf2]">
        {bands.map((band) => {
          const amount = new Decimal(band.amount).abs()
          if (amount.isZero()) return null
          const share = total.isZero() ? 0 : amount.dividedBy(total).times(100).toNumber()
          return (
            <span
              key={band.key}
              className={band.bar}
              style={{ width: `${Math.max(share, 1.5)}%` }}
              title={`${band.detail}: ${formatMoney(band.amount, currency)}`}
            />
          )
        })}
      </div>
      <button
        type="button"
        onClick={toggle}
        className="absolute bottom-1 right-2 inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-white hover:text-foreground"
        aria-expanded={true}
        aria-label="Hide money summary"
      >
        <ChevronUpIcon className="size-4" />
      </button>
    </div>
  )
}