'use client'

import { useEffect, useMemo, useState } from 'react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import { usePathname } from 'next/navigation'
import { Columns3Icon, SearchIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'

const storageKey = (path: string) => `bpc.reportCols:${path}`
const splitKey = (path: string) => `bpc.reportSplits:${path}`
const templateKey = 'bpc.reportTemplate'

type ReportTemplate = 'standard' | 'compact' | 'plain'

const TEMPLATES: { id: ReportTemplate; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'compact', label: 'Compact' },
  { id: 'plain', label: 'Plain' },
]

/**
 * Search and column visibility for whichever report is on screen.
 * Every row of the report can be found, and every column can be hidden or shown.
 * The hidden columns are remembered per report on this browser.
 */
function parseList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function ReportTools() {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [path, setPath] = useState(pathname)
  if (path !== pathname) {
    setPath(pathname)
    setQuery('')
  }
  const [headers, setHeaders] = useState<string[]>([])
  const [splits, setSplits] = useState<string[]>([])
  const hiddenRaw = useBrowserStore(storageKey(pathname))
  const splitRaw = useBrowserStore(splitKey(pathname))
  const savedTemplate = useBrowserStore(templateKey)
  const hidden = useMemo(() => parseList(hiddenRaw), [hiddenRaw])
  // No saved choice means every split account is on. A stored list, even an
  // empty one, is a choice the person already made.
  const shownSplits = useMemo(() => (splitRaw === null ? null : parseList(splitRaw)), [splitRaw])
  const [match, setMatch] = useState<{ shown: number; total: number } | null>(null)
  const template: ReportTemplate =
    savedTemplate === 'compact' || savedTemplate === 'plain' || savedTemplate === 'standard'
      ? savedTemplate
      : 'standard'

  useEffect(() => {
    const root = document.querySelector('[data-report-root]')
    if (!root) return
    root.setAttribute('data-template', template)
  }, [pathname, template])

  useEffect(() => {
    const root = document.querySelector('[data-report-root]')
    if (!root) return

    const apply = () => {
      const table = root.querySelector('table')
      if (!table) {
        setHeaders((current) => (current.length === 0 ? current : []))
        setMatch(null)
        return
      }

      const headRow = table.querySelector(':scope > thead > tr:not([data-column-band])')
      const headCells = headRow ? ([...headRow.children] as HTMLElement[]) : []
      const labels: string[] = []
      headCells.forEach((cell) => {
        if (cell.dataset.splitAccount || cell.hasAttribute('data-column-band')) return
        labels.push(cell.textContent?.replace(/\s+/g, ' ').trim() || 'Column')
      })
      const splitLabels = [
        ...new Set(
          [...table.querySelectorAll<HTMLElement>('[data-split-account]')]
            .map((cell) => cell.dataset.splitAccount)
            .filter((label): label is string => Boolean(label)),
        ),
      ]
      setHeaders((current) => (current.join('\n') === labels.join('\n') ? current : labels))
      setSplits((current) => (current.join('\n') === splitLabels.join('\n') ? current : splitLabels))

      const hiddenSet = new Set(hidden)
      const shownSplitSet = shownSplits === null ? null : new Set(shownSplits)
      headCells.forEach((cell, index) => {
        if (cell.dataset.splitAccount) return
        const label = cell.textContent?.replace(/\s+/g, ' ').trim() || 'Column'
        const off = hiddenSet.has(label)
        table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr').forEach((row) => {
          if ((row as HTMLElement).hasAttribute('data-column-band')) return
          const target = row.children[index] as HTMLElement | undefined
          if (target) target.hidden = off
        })
      })

      table.querySelectorAll<HTMLElement>('[data-split-account]').forEach((cell) => {
        const split = cell.dataset.splitAccount
        if (!split || shownSplitSet === null) {
          cell.hidden = false
          return
        }
        cell.hidden = !shownSplitSet.has(split)
      })
      table.querySelectorAll<HTMLElement>('[data-column-band]').forEach((row) => {
        const items = [...row.querySelectorAll<HTMLElement>('[data-split-account]')]
        if (items.length === 0) return
        row.hidden = items.every((item) => item.hidden)
      })

      const needle = query.trim().toLowerCase()
      const rows = [...table.querySelectorAll(':scope > tbody > tr')]
      let shown = 0
      rows.forEach((row, index) => {
        if ((row as HTMLElement).hasAttribute('data-column-band')) return
        const next = rows[index + 1] as HTMLElement | undefined
        const band = next?.hasAttribute('data-column-band') ? next : null
        const text = `${row.textContent ?? ''} ${band?.textContent ?? ''}`.toLowerCase()
        const keep = !needle || text.includes(needle)
        ;(row as HTMLElement).hidden = !keep
        if (band) {
          const bandSplits = [...band.querySelectorAll<HTMLElement>('[data-split-account]')]
          const splitsOff = bandSplits.length > 0 && bandSplits.every((item) => item.hidden)
          band.hidden = !keep || splitsOff
        }
        if (keep) shown += 1
      })
      const footer = table.querySelector(':scope > tfoot') as HTMLElement | null
      if (footer) footer.hidden = Boolean(needle)
      const total = rows.length
      setMatch((current) => {
        if (!needle) return current === null ? current : null
        if (current && current.shown === shown && current.total === total) return current
        return { shown, total }
      })
    }

    apply()
    const observer = new MutationObserver(apply)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname, query, hidden, shownSplits])

  if (headers.length === 0 && splits.length === 0) return null

  const toggle = (label: string) => {
    const next = hidden.includes(label) ? hidden.filter((item) => item !== label) : [...hidden, label]
    const visible = headers.filter((header) => !next.includes(header))
    const safe = visible.length === 0 ? hidden : next
    writeBrowserStore(storageKey(pathname), JSON.stringify(safe))
  }

  const toggleSplit = (label: string) => {
    const base = shownSplits ?? splits
    const next = base.includes(label) ? base.filter((item) => item !== label) : [...base, label]
    writeBrowserStore(splitKey(pathname), JSON.stringify(next))
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
      <div className="relative w-full max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this report"
          aria-label="Search this report"
          className="pl-7"
        />
      </div>
      {match ? (
        <p className="text-sm text-muted-foreground">
          Showing {match.shown} of {match.total}
        </p>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-1" role="group" aria-label="Report template">
        {TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={template === item.id}
            onClick={() => writeBrowserStore(templateKey, item.id)}
            className={`rounded-md px-2.5 py-1 text-sm ${
              template === item.id ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <details className="relative">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
          <Columns3Icon className="size-3.5 text-muted-foreground" aria-hidden />
          Columns
        </summary>
        <div className="absolute right-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border bg-card p-2 shadow-md">
          {headers.map((label) => (
            <label key={label} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
              <input
                type="checkbox"
                checked={!hidden.includes(label)}
                onChange={() => toggle(label)}
                className="size-3.5 accent-primary"
              />
              {label}
            </label>
          ))}
          {splits.length > 0 ? (
            <>
              <p className="px-2 pb-1 pt-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Split accounts
              </p>
              {splits.map((label) => (
                <label key={label} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={shownSplits === null || shownSplits.includes(label)}
                    onChange={() => toggleSplit(label)}
                    className="size-3.5 accent-primary"
                  />
                  {label}
                </label>
              ))}
            </>
          ) : null}
        </div>
      </details>
    </div>
  )
}
