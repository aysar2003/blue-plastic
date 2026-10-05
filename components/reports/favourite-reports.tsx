'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ChevronDownIcon, StarIcon } from 'lucide-react'

import type { StandardReport } from '@/lib/standard-reports'
import { cn } from '@/lib/utils'

const STORAGE = 'bpc.reportFavourites'
const CHANGE = 'bpc-report-favourites'

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange)
  return () => window.removeEventListener(CHANGE, onChange)
}

let cached = ''

function readSnapshot() {
  const next = window.localStorage.getItem(STORAGE) ?? ''
  if (next !== cached) cached = next
  return cached
}

export function FavouriteReports({ reports }: { reports: StandardReport[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(true)
  const raw = useSyncExternalStore(subscribe, readSnapshot, () => '')

  const starred = useMemo(() => {
    const fallback = reports.map((report) => report.href + report.label)
    if (!raw) return fallback
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : fallback
    } catch {
      return fallback
    }
  }, [raw, reports])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? reports.filter((report) => report.label.toLowerCase().includes(q)) : reports
  }, [query, reports])

  function toggle(key: string) {
    const next = starred.includes(key) ? starred.filter((item) => item !== key) : [...starred, key]
    const encoded = JSON.stringify(next)
    window.localStorage.setItem(STORAGE, encoded)
    cached = encoded
    window.dispatchEvent(new Event(CHANGE))
  }

  const midpoint = Math.ceil(visible.length / 2)
  const columns = [visible.slice(0, midpoint), visible.slice(midpoint)]

  return (
    <section className="mb-8 overflow-hidden rounded-lg border bg-card">
      <div className="border-b px-4 py-3 print:hidden">
        <label className="sr-only" htmlFor="report-name-search">
          Type report name here
        </label>
        <input
          id="report-name-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type report name here"
          className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
        />
      </div>
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b px-4 py-3 text-left text-sm font-semibold"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDownIcon className={cn('size-4 transition-transform', open ? '' : '-rotate-90')} />
        Favourites
      </button>
      {open ? (
        <div className="grid gap-0 md:grid-cols-2">
          {columns.map((column, index) => (
            <ul key={index} className={index === 0 ? 'md:border-r' : undefined}>
              {column.map((report) => {
                const key = report.href + report.label
                const on = starred?.includes(key) ?? true
                return (
                  <li key={key} className="flex items-center gap-2 border-b px-4 py-2.5 last:border-b-0">
                    <Link href={report.href} className="min-w-0 flex-1 text-sm hover:text-primary hover:underline">
                      {report.label}
                    </Link>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={on ? `Remove ${report.label} from favourites` : `Star ${report.label}`}
                      onClick={() => toggle(key)}
                      className="text-primary"
                    >
                      <StarIcon className={cn('size-4', on ? 'fill-primary' : 'fill-transparent')} />
                    </button>
                  </li>
                )
              })}
            </ul>
          ))}
        </div>
      ) : null}
      {open && visible.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No report matches that name.</p>
      ) : null}
    </section>
  )
}
