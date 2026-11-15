'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ChevronDownIcon, StarIcon } from 'lucide-react'

import {
  REPORT_FAVOURITES_CHANGE,
  REPORT_FAVOURITES_STORAGE,
  parseReportFavourites,
  reportFavouriteKey,
  toggleReportFavourite,
  type ReportFavourite,
} from '@/lib/report-favourites'
import { cn } from '@/lib/utils'

function subscribe(onChange: () => void) {
  window.addEventListener(REPORT_FAVOURITES_CHANGE, onChange)
  return () => window.removeEventListener(REPORT_FAVOURITES_CHANGE, onChange)
}

let cached = ''

function readSnapshot() {
  const next = window.localStorage.getItem(REPORT_FAVOURITES_STORAGE) ?? ''
  if (next !== cached) cached = next
  return cached
}

export function writeReportFavourites(next: ReportFavourite[]) {
  const encoded = JSON.stringify(next)
  window.localStorage.setItem(REPORT_FAVOURITES_STORAGE, encoded)
  cached = encoded
  window.dispatchEvent(new Event(REPORT_FAVOURITES_CHANGE))
}

export function useReportFavourites() {
  const raw = useSyncExternalStore(subscribe, readSnapshot, () => '')
  return useMemo(() => parseReportFavourites(raw || null), [raw])
}

export function FavouriteReports({
  emptyHint = 'No favourites yet. Star a report in the sections below to add it here.',
}: {
  emptyHint?: string
} = {}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(true)
  const starred = useReportFavourites()

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return starred.filter((report) => !q || report.label.toLowerCase().includes(q))
  }, [query, starred])

  function toggle(report: ReportFavourite) {
    writeReportFavourites(toggleReportFavourite(starred, report))
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
        visible.length > 0 ? (
          <div className="grid gap-0 md:grid-cols-2">
            {columns.map((column, index) => (
              <ul key={index} className={index === 0 ? 'md:border-r' : undefined}>
                {column.map((report) => {
                  const key = reportFavouriteKey(report)
                  return (
                    <li key={key} className="flex items-center gap-2 border-b px-4 py-2.5 last:border-b-0">
                      <Link
                        href={report.href}
                        className="min-w-0 flex-1 text-sm text-foreground hover:text-primary hover:underline"
                      >
                        {report.label}
                      </Link>
                      <button
                        type="button"
                        aria-pressed
                        aria-label={`Remove ${report.label} from favourites`}
                        onClick={() => toggle(report)}
                        className="text-primary"
                      >
                        <StarIcon className="size-4 fill-primary" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {query.trim() ? 'No favourite matches that name.' : emptyHint}
          </p>
        )
      ) : null}
    </section>
  )
}

export function ReportFavouriteStar({ href, label }: ReportFavourite) {
  const starred = useReportFavourites()
  const on = starred.some((item) => reportFavouriteKey(item) === reportFavouriteKey({ href, label }))

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${label} from favourites` : `Star ${label}`}
      onClick={() => writeReportFavourites(toggleReportFavourite(starred, { href, label }))}
      className="shrink-0 text-primary"
    >
      <StarIcon className={cn('size-4', on ? 'fill-primary' : 'fill-transparent')} />
    </button>
  )
}
