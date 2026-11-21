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
  emptyHint = 'Star any report below to pin it here.',
}: {
  emptyHint?: string
} = {}) {
  const [open, setOpen] = useState(true)
  const starred = useReportFavourites()

  function toggle(report: ReportFavourite) {
    writeReportFavourites(toggleReportFavourite(starred, report))
  }

  if (starred.length === 0) {
    return (
      <p className="mb-5 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground print:hidden">
        {emptyHint}
      </p>
    )
  }

  const midpoint = Math.ceil(starred.length / 2)
  const columns = [starred.slice(0, midpoint), starred.slice(midpoint)]

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm font-semibold"
        onClick={() => setOpen((value) => !value)}
      >
        <StarIcon className="size-4 fill-primary text-primary" />
        <span className="flex-1">Favourites</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {starred.length}
        </span>
        <ChevronDownIcon className={cn('size-4 transition-transform', open ? '' : '-rotate-90')} />
      </button>
      {open ? (
        <div className="grid border-t border-border/60 md:grid-cols-2">
          {columns.map((column, index) => (
            <ul key={index} className={index === 0 ? 'md:border-r md:border-border/60' : undefined}>
              {column.map((report) => {
                const key = reportFavouriteKey(report)
                return (
                  <li
                    key={key}
                    className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5 last:border-b-0 hover:bg-muted/25"
                  >
                    <Link
                      href={report.href}
                      className="min-w-0 flex-1 text-sm font-medium hover:text-primary"
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
      className="shrink-0 text-primary opacity-70 transition hover:opacity-100"
    >
      <StarIcon className={cn('size-4', on ? 'fill-primary' : 'fill-transparent')} />
    </button>
  )
}
