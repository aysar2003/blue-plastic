'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon, SearchIcon } from 'lucide-react'

import type { LauncherSection } from '@/components/layout/app-launcher'
import { ReportFavouriteStar } from '@/components/reports/favourite-reports'
import { cn } from '@/lib/utils'

/**
 * Modern standard catalogue: one search, collapsible sections, clean rows.
 */
export function StandardReportSections({
  sections,
  headings = true,
}: {
  sections: LauncherSection[]
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
      <div className="relative print:hidden">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <label className="sr-only" htmlFor="report-section-search">
          Find a report
        </label>
        <input
          id="report-section-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all reports…"
          className="h-11 w-full rounded-2xl border border-border/60 bg-card pl-10 pr-4 text-sm shadow-sm outline-none ring-primary/20 focus:ring-2"
        />
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No report matches that name.
        </p>
      ) : headings ? null : (
        <ReportColumns apps={shown.flatMap((section) => section.apps)} framed />
      )}

      {headings
        ? shown.map((section, sectionIndex) => {
            const open = needle ? true : !closed[section.label]
            return (
              <section
                key={section.label}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm"
                style={{ animationDelay: `${sectionIndex * 30}ms` }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/30"
                  aria-expanded={open}
                  onClick={() =>
                    setClosed((current) => ({
                      ...current,
                      [section.label]: !current[section.label],
                    }))
                  }
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                    {section.apps.length}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold tracking-tight">{section.label}</span>
                    {section.blurb ? (
                      <span className="block text-xs text-muted-foreground">{section.blurb}</span>
                    ) : null}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      open ? '' : '-rotate-90',
                    )}
                  />
                </button>
                {open ? (
                  <div className="border-t border-border/60">
                    <ReportColumns apps={section.apps} />
                  </div>
                ) : null}
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
    <div className={cn('grid md:grid-cols-2', framed && 'overflow-hidden rounded-2xl border bg-card')}>
      {columns.map((column, index) => (
        <ul key={index} className={index === 0 ? 'md:border-r md:border-border/60' : undefined}>
          {column.map((app) => (
            <li
              key={app.key}
              className="group flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-b-0 hover:bg-muted/25"
            >
              <span
                aria-hidden
                className="app-chroma-dot mt-1.5 size-2 shrink-0 rounded-full"
                style={{ background: app.accent ?? '#64748b' }}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={app.href}
                  className="block text-sm font-medium text-foreground group-hover:text-primary"
                >
                  {app.label}
                </Link>
                {app.blurb ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{app.blurb}</span>
                ) : null}
              </div>
              <ReportFavouriteStar href={app.href} label={app.label} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
