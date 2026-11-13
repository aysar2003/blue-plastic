'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'

import type { LauncherSection } from '@/components/layout/app-launcher'
import { cn } from '@/lib/utils'

/**
 * The report catalogue as one standard list: each group follows the one above
 * it, and every name opens its report. The same order as the Reports menu.
 */
export function StandardReportSections({
  sections,
  headings = true,
}: {
  sections: LauncherSection[]
  /** Module hubs are one list of names. The main catalogue keeps a heading per group. */
  headings?: boolean
}) {
  const [query, setQuery] = useState('')
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const needle = query.trim().toLowerCase()

  const shown = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          apps: section.apps.filter(
            (app) =>
              !needle ||
              `${section.label} ${section.blurb ?? ''} ${app.label} ${app.blurb ?? ''}`
                .toLowerCase()
                .includes(needle),
          ),
        }))
        .filter((section) => section.apps.length > 0),
    [needle, sections],
  )

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <label className="sr-only" htmlFor="report-section-search">
          Find a report
        </label>
        <input
          id="report-section-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={headings ? 'Find a report in the sections below' : 'Find a report'}
          className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No report matches that name.</p>
      ) : headings ? null : (
        <ReportColumns apps={shown.flatMap((section) => section.apps)} framed />
      )}

      {headings
        ? shown.map((section) => {
            const open = needle ? true : !closed[section.label]
            return (
              <section key={section.label} className="overflow-hidden rounded-lg border bg-card">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-b px-4 py-3 text-left"
                  aria-expanded={open}
                  onClick={() =>
                    setClosed((current) => ({ ...current, [section.label]: !current[section.label] }))
                  }
                >
                  <ChevronDownIcon
                    className={cn('size-4 shrink-0 transition-transform', open ? '' : '-rotate-90')}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{section.label}</span>
                    {section.blurb ? (
                      <span className="block text-xs text-muted-foreground">{section.blurb}</span>
                    ) : null}
                  </span>
                </button>
                {open ? <ReportColumns apps={section.apps} /> : null}
              </section>
            )
          })
        : null}
    </div>
  )
}

function ReportColumns({
  apps,
  framed = false,
}: {
  apps: LauncherSection['apps']
  framed?: boolean
}) {
  const midpoint = Math.ceil(apps.length / 2)
  const columns = [apps.slice(0, midpoint), apps.slice(midpoint)]
  return (
    <div className={cn('grid md:grid-cols-2', framed && 'overflow-hidden rounded-lg border bg-card')}>
      {columns.map((column, index) => (
        <ul key={index} className={index === 0 ? 'md:border-r' : undefined}>
          {column.map((app) => (
            <li key={app.key} className="border-b px-4 py-2.5 last:border-b-0">
              <Link
                href={app.href}
                className="block text-sm text-foreground hover:text-primary hover:underline"
              >
                {app.label}
              </Link>
              {app.blurb ? (
                <span className="block text-xs text-muted-foreground">{app.blurb}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
