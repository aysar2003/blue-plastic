'use client'

import { useEffect, useRef, useState } from 'react'
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

const MIN_HEIGHT = 56
const MAX_HEIGHT = 160
const COLLAPSE_BELOW = 36
/** Tall enough that the coloured share strip under the tiles stays visible. */
const DEFAULT_HEIGHT = 118

/**
 * QuickBooks-style money strip above the customer / vendor list.
 * Click a band to filter the list. Drag the bottom edge up or down to resize;
 * the chevron collapses the whole strip.
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
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const heightRef = useRef(height)
  const drag = useRef<{ startY: number; startH: number } | null>(null)

  useEffect(() => {
    heightRef.current = height
  }, [height])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved panel state from localStorage after hydration
      if (stored === '0') setOpen(false)
      if (stored === '1') setOpen(true)
      const h = window.localStorage.getItem(`${storageKey}:h`)
      if (h) {
        const n = Number(h)
        if (Number.isFinite(n)) setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, n)))
      }
    } catch {
      /* keep default */
    }
  }, [storageKey])

  function persistOpen(next: boolean) {
    try {
      window.localStorage.setItem(storageKey, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  function persistHeight(next: number) {
    try {
      window.localStorage.setItem(`${storageKey}:h`, String(next))
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    setOpen((current) => {
      const next = !current
      persistOpen(next)
      return next
    })
  }

  function onResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    drag.current = { startY: event.clientY, startH: height }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const delta = event.clientY - drag.current.startY
    const next = drag.current.startH + delta
    if (next < COLLAPSE_BELOW) {
      setOpen(false)
      persistOpen(false)
      drag.current = null
      return
    }
    const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next))
    heightRef.current = clamped
    setHeight(clamped)
  }

  function onResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    drag.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
    persistHeight(heightRef.current)
  }

  const total = bands.reduce((sum, band) => sum.plus(new Decimal(band.amount).abs()), new Decimal(0))
  const compact = height < 78
  const showBar = height >= 90

  if (!open) {
    return (
      <div className="flex items-center justify-end border-b bg-muted/70 px-3 py-1">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground"
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
    <div className="relative border-b bg-muted/70">
      <div className="overflow-hidden px-4 pt-2" style={{ height }}>
        <div
          className={cn(
            'grid gap-1.5 sm:gap-2',
            bands.length >= 5 ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4',
          )}
        >
          {bands.map((band) => {
            const selected = active === band.key
            return (
              <Link
                key={band.key}
                href={band.href}
                className={cn(
                  // ~3/5 of the old tile size: tighter padding and type.
                  'rounded-lg border border-border/80 bg-card px-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors',
                  compact ? 'py-1.5' : 'py-2',
                  'hover:border-border hover:bg-[var(--band)]',
                  selected && 'border-border bg-[var(--band)] shadow-sm ring-1 ring-border',
                )}
                aria-current={selected ? 'true' : undefined}
              >
                <p
                  className={cn(
                    'tabular font-semibold leading-none tracking-tight text-foreground',
                    compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg',
                    band.accent ? band.accent : null,
                  )}
                >
                  {formatMoney(band.amount, currency)}
                </p>
                <p className={cn('text-xs text-muted-foreground', compact ? 'mt-0.5' : 'mt-1')}>
                  <span
                    className={cn(
                      'font-medium',
                      band.key === 'overdue' && (band.accent ?? 'text-[var(--warning,#d4652f)]'),
                    )}
                  >
                    {band.detail}
                  </span>
                </p>
              </Link>
            )
          })}
        </div>
        {showBar ? (
          <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full bg-border/40 p-0.5">
            {bands.map((band) => {
              const amount = new Decimal(band.amount).abs()
              if (amount.isZero()) return null
              const share = total.isZero() ? 0 : amount.dividedBy(total).times(100).toNumber()
              const selected = active === band.key
              return (
                <Link
                  key={band.key}
                  href={band.href}
                  className={cn(
                    'h-full min-w-1 rounded-full transition-opacity hover:opacity-90',
                    band.bar,
                    active && !selected && 'opacity-35',
                  )}
                  style={{ flexGrow: Math.max(share, 1.5), flexBasis: 0 }}
                  title={`${band.detail}: ${formatMoney(band.amount, currency)}`}
                  aria-current={selected ? 'page' : undefined}
                  aria-label={`${band.detail}: ${formatMoney(band.amount, currency)}. Filter the list.`}
                />
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-2 px-2 pb-0.5">
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize money summary"
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={MAX_HEIGHT}
          aria-valuenow={height}
          tabIndex={0}
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              const next = Math.max(MIN_HEIGHT, height - 12)
              setHeight(next)
              persistHeight(next)
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              const next = Math.min(MAX_HEIGHT, height + 12)
              setHeight(next)
              persistHeight(next)
            } else if (event.key === 'Home') {
              event.preventDefault()
              setOpen(false)
              persistOpen(false)
            }
          }}
          className="group flex h-3 w-full max-w-xs cursor-ns-resize items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-muted-foreground/50 group-active:bg-primary" />
        </div>
        <button
          type="button"
          onClick={toggle}
          className="absolute bottom-0.5 right-2 inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-card hover:text-foreground"
          aria-expanded={true}
          aria-label="Hide money summary"
        >
          <ChevronUpIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
