'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The customer / vendor information block on the right. A small chevron hides
 * the detail grid so the transaction list gets the height — QuickBooks style.
 */
export function CollapsibleProfile({
  title,
  headerExtra,
  storageKey,
  children,
  empty,
}: {
  title: string
  headerExtra?: ReactNode
  storageKey: string
  children: ReactNode
  empty?: ReactNode
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

  return (
    <div className="border-b">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            onClick={toggle}
            className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-expanded={open}
            aria-label={open ? 'Hide information' : 'Show information'}
          >
            {open ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-lg font-semibold">{title}</h1>
              {headerExtra ? (
                <div className="flex shrink-0 items-center [&>div]:flex-row [&>div]:gap-1">{headerExtra}</div>
              ) : null}
            </div>
            {open ? <div className="mt-3">{children}</div> : null}
            {!open && empty ? <div className="mt-1">{empty}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProfileFieldGrid({
  company,
  fullName,
  billTo,
  phone,
  workPhone,
  className,
}: {
  company: string
  fullName: string
  billTo: string[]
  phone: string | null
  workPhone: string | null
  className?: string
}) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2', className)}>
      <div>
        <dt className="text-xs text-muted-foreground">Company name</dt>
        <dd>{company}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Main phone</dt>
        <dd>{phone ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Full name</dt>
        <dd className="uppercase">{fullName}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Work phone</dt>
        <dd>{workPhone ?? '—'}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs text-muted-foreground">Bill to</dt>
        <dd>{billTo.length > 0 ? billTo.join(', ') : '—'}</dd>
      </div>
    </dl>
  )
}
