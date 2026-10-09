'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, GripVerticalIcon } from 'lucide-react'

import { TableColumnCustomize } from '@/components/data/table-column-customize'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime, isCalendarDate } from '@/lib/date'
import {
  compareSortValues,
  defaultColumnWidth,
  mergeGridLayout,
  moveItem,
  nextSort,
  sumAmounts,
  type GridLayout,
  type GridSort,
} from '@/lib/interactive-grid'
import { formatMoney, formatSignedQuantity } from '@/lib/money'
import { cn } from '@/lib/utils'

export type InteractiveColumn = {
  id: string
  label: string
  kind?: 'text' | 'money' | 'number' | 'signed' | 'date' | 'datetime'
  /** When false, the Total row leaves this column blank. Defaults to on for figures. */
  total?: boolean
  defaultWidth?: number
  minWidth?: number
}

export type InteractiveCell = {
  /** Plain value: a decimal, an ISO timestamp, a calendar date, or text. */
  value: string | null
  href?: string | null
  badge?: string | null
  /** Used instead of `value` when the column should sort on something else. */
  sort?: string | null
}

export type InteractiveRow = {
  id: string
  cells: Record<string, InteractiveCell | null | undefined>
  /** Opening and closing rows stay on screen but are not added into Total. */
  excludeFromTotal?: boolean
  emphasis?: boolean
  className?: string
}

export type InteractiveFooter = {
  id: string
  /** Written into the first visible column that does not already have a cell. */
  label?: string
  cells: Record<string, InteractiveCell | null | undefined>
}

const LINK = 'underline-offset-4 hover:underline'

const layoutListeners = new Set<() => void>()
const layoutCache = new Map<string, string>()

function subscribeLayout(onChange: () => void) {
  layoutListeners.add(onChange)
  return () => layoutListeners.delete(onChange)
}

function readLayoutRaw(key: string): string {
  const hit = layoutCache.get(key)
  if (hit !== undefined) return hit
  let raw = ''
  try {
    raw = window.localStorage.getItem(key) ?? ''
  } catch {
    raw = ''
  }
  layoutCache.set(key, raw)
  return raw
}

function writeLayout(key: string, layout: GridLayout) {
  const raw = JSON.stringify(layout)
  try {
    window.localStorage.setItem(key, raw)
  } catch {
    // Private mode or a full disk: the arrangement just is not remembered.
  }
  layoutCache.set(key, raw)
  for (const listener of layoutListeners) listener()
}

function parseLayout(raw: string): Partial<GridLayout> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<GridLayout>
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function isFigure(kind: InteractiveColumn['kind']) {
  return kind === 'money' || kind === 'number' || kind === 'signed'
}

function totalsColumn(column: InteractiveColumn) {
  if (column.total !== undefined) return column.total
  return isFigure(column.kind)
}

function present(
  column: InteractiveColumn,
  cell: InteractiveCell | null | undefined,
  currency: string,
  timeZone: string,
): string {
  const value = cell?.value
  if (value == null || value === '') return ''
  if (column.kind === 'money' && /^-?\d+(\.\d+)?$/.test(value)) return formatMoney(value, currency)
  if (column.kind === 'signed' && /^-?\d+(\.\d+)?$/.test(value)) return formatSignedQuantity(value)
  if (column.kind === 'number' && /^-?\d+(\.\d+)?$/.test(value)) return value
  if (column.kind === 'date' || column.kind === 'datetime') {
    if (isCalendarDate(value)) return formatDate(value)
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return formatDateTime(parsed, timeZone)
    }
  }
  return value
}

export function InteractiveGrid({
  storageKey,
  columns,
  rows,
  currency,
  timeZone = 'UTC',
  defaultHidden = [],
  initialSort = null,
  showTotal = true,
  totalLabel = 'Total',
  footers = [],
  customizable = false,
  note,
}: {
  storageKey: string
  columns: InteractiveColumn[]
  rows: InteractiveRow[]
  currency: string
  timeZone?: string
  defaultHidden?: string[]
  initialSort?: GridSort | null
  showTotal?: boolean
  totalLabel?: string
  footers?: InteractiveFooter[]
  customizable?: boolean
  note?: string
}) {
  const idsKey = columns.map((column) => column.id).join('|')
  const hiddenKey = defaultHidden.join('|')
  const widthDefaults = useMemo(() => {
    const widths: Record<string, number> = {}
    for (const column of columns) widths[column.id] = column.defaultWidth ?? defaultColumnWidth(column.kind)
    return widths
  }, [columns])
  const ids = useMemo(() => (idsKey ? idsKey.split('|') : []), [idsKey])
  const hidden = useMemo(() => (hiddenKey ? hiddenKey.split('|') : []), [hiddenKey])
  const stored = useSyncExternalStore(subscribeLayout, () => readLayoutRaw(storageKey), () => '')
  const saved = useMemo(() => parseLayout(stored), [stored])
  const baseLayout = useMemo(
    () => mergeGridLayout(saved, ids, hidden, widthDefaults),
    [saved, ids, hidden, widthDefaults],
  )
  const [liveWidth, setLiveWidth] = useState<{ id: string; width: number } | null>(null)
  const layout = useMemo(() => {
    if (!liveWidth) return baseLayout
    return { ...baseLayout, widths: { ...baseLayout.widths, [liveWidth.id]: liveWidth.width } }
  }, [baseLayout, liveWidth])
  const [sort, setSort] = useState<GridSort | null>(initialSort)
  const [dragId, setDragId] = useState<string | null>(null)

  const byId = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns])
  const visible = layout.order
    .filter((id) => !layout.hidden.includes(id))
    .map((id) => byId.get(id))
    .filter((column): column is InteractiveColumn => Boolean(column))

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const column = byId.get(sort.id)
    const numeric = isFigure(column?.kind)
    return [...rows].sort((a, b) => {
      const left = a.cells[sort.id]
      const right = b.cells[sort.id]
      return compareSortValues(left?.sort ?? left?.value, right?.sort ?? right?.value, sort.dir, numeric)
    })
  }, [rows, sort, byId])

  const totalFooter = useMemo<InteractiveFooter | null>(() => {
    if (!showTotal) return null
    const cells: InteractiveFooter['cells'] = {}
    let any = false
    for (const column of columns) {
      if (!totalsColumn(column)) continue
      any = true
      cells[column.id] = {
        value: sumAmounts(
          rows.filter((row) => !row.excludeFromTotal).map((row) => row.cells[column.id]?.value),
        ),
      }
    }
    return any ? { id: '__total', label: totalLabel, cells } : null
  }, [showTotal, columns, rows, totalLabel])

  const renderedFooters = [...(totalFooter ? [totalFooter] : []), ...footers]

  function toggleSort(column: InteractiveColumn) {
    setSort((current) => nextSort(current, column.id, isFigure(column.kind)))
  }

  function reorder(from: string, to: string) {
    writeLayout(storageKey, { ...baseLayout, order: moveItem(baseLayout.order, from, to) })
  }

  function toggleColumn(id: string) {
    writeLayout(storageKey, {
      ...baseLayout,
      hidden: baseLayout.hidden.includes(id)
        ? baseLayout.hidden.filter((item) => item !== id)
        : [...baseLayout.hidden, id],
    })
  }

  function startResize(event: React.PointerEvent, column: InteractiveColumn) {
    event.preventDefault()
    event.stopPropagation()
    const min = column.minWidth ?? 72
    const startX = event.clientX
    const startWidth = baseLayout.widths[column.id] ?? column.defaultWidth ?? defaultColumnWidth(column.kind)
    let width = startWidth
    const move = (moveEvent: PointerEvent) => {
      width = Math.max(min, Math.round(startWidth + moveEvent.clientX - startX))
      setLiveWidth({ id: column.id, width })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      writeLayout(storageKey, { ...baseLayout, widths: { ...baseLayout.widths, [column.id]: width } })
      setLiveWidth(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const tableWidth = visible.reduce((sum, column) => sum + (layout.widths[column.id] ?? 160), 0)

  return (
    <div>
      {customizable ? (
        <div className="mb-2 flex justify-end print:hidden">
          <TableColumnCustomize
            columns={columns.map((column) => ({ id: column.id, label: column.label }))}
            prefs={layout}
            onToggle={toggleColumn}
            onReorder={reorder}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border bg-card">
        <Table containerClassName="overflow-x-auto" style={{ width: Math.max(tableWidth, 0), minWidth: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            {visible.map((column) => (
              <col key={column.id} style={{ width: layout.widths[column.id] ?? 160 }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow>
              {visible.map((column) => {
                const numeric = isFigure(column.kind)
                const active = sort?.id === column.id
                const Icon = active ? (sort.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon) : ChevronsUpDownIcon
                return (
                  <TableHead
                    key={column.id}
                    className={cn('relative', numeric && 'numeric', dragId === column.id && 'bg-primary/10')}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const from = event.dataTransfer.getData('text/plain') || dragId
                      if (from) reorder(from, column.id)
                      setDragId(null)
                    }}
                  >
                    <div className={cn('flex items-center gap-1', numeric && 'flex-row-reverse')}>
                      <span
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', column.id)
                          event.dataTransfer.effectAllowed = 'move'
                          setDragId(column.id)
                        }}
                        onDragEnd={() => setDragId(null)}
                        className="print:hidden inline-flex shrink-0 cursor-grab text-foreground/55 active:cursor-grabbing"
                        aria-label={`Drag to move ${column.label}`}
                        title="Drag to move this column"
                      >
                        <GripVerticalIcon className="size-3.5" aria-hidden />
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          'inline-flex min-w-0 flex-1 items-center gap-1 rounded-sm text-left transition-colors hover:text-foreground',
                          numeric && 'flex-row-reverse text-right',
                          active ? 'text-foreground' : 'text-foreground/80',
                        )}
                      >
                        <span className="truncate">{column.label}</span>
                        <Icon className={cn('size-3.5 shrink-0', !active && 'opacity-55')} />
                      </button>
                    </div>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${column.label}`}
                      className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none hover:bg-primary/30 print:hidden"
                      onPointerDown={(event) => startResize(event, column)}
                    />
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.id} className={cn(row.emphasis && 'bg-muted/40', row.className)}>
                {visible.map((column) => (
                  <GridCellView
                    key={column.id}
                    column={column}
                    cell={row.cells[column.id]}
                    currency={currency}
                    timeZone={timeZone}
                    emphasis={row.emphasis}
                  />
                ))}
              </TableRow>
            ))}
          </TableBody>
          {renderedFooters.length > 0 ? (
            <TableFooter>
              {renderedFooters.map((footer) => {
                const hiddenFigures = columns
                  .filter((column) => !visible.some((shown) => shown.id === column.id))
                  .map((column) => present(column, footer.cells[column.id], currency, timeZone))
                  .filter(Boolean)
                return (
                  <TableRow key={footer.id}>
                    {visible.map((column, index) => {
                      const explicit = footer.cells[column.id]
                      const labelHere = Boolean(footer.label) && !explicit?.value && index === firstLabelIndex(visible, footer)
                      const text = labelHere
                        ? hiddenFigures.length
                          ? `${footer.label} ${hiddenFigures.join(' · ')}`
                          : footer.label!
                        : present(column, explicit, currency, timeZone)
                      return (
                        <TableCell
                          key={column.id}
                          className={cn('font-semibold', isFigure(column.kind) && 'numeric tabular', column.kind === 'datetime' && 'whitespace-nowrap')}
                        >
                          {text || (labelHere ? footer.label : '')}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableFooter>
          ) : null}
        </Table>
      </div>
      {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}

function firstLabelIndex(visible: InteractiveColumn[], footer: InteractiveFooter) {
  const index = visible.findIndex((column) => !footer.cells[column.id]?.value)
  return index < 0 ? 0 : index
}

function GridCellView({
  column,
  cell,
  currency,
  timeZone,
  emphasis,
}: {
  column: InteractiveColumn
  cell: InteractiveCell | null | undefined
  currency: string
  timeZone: string
  emphasis?: boolean
}) {
  const numeric = isFigure(column.kind)
  const text = present(column, cell, currency, timeZone)
  const className = cn(
    numeric && 'numeric tabular',
    (column.kind === 'date' || column.kind === 'datetime') && 'tabular whitespace-nowrap',
    emphasis && 'font-medium',
    !numeric && 'truncate',
  )
  if (!text) {
    return (
      <TableCell className={className}>
        {numeric ? '' : <span className="text-muted-foreground">—</span>}
      </TableCell>
    )
  }
  const body = (
    <>
      {text}
      {cell?.badge ? (
        <Badge variant="outline" className="ml-1.5">
          {cell.badge}
        </Badge>
      ) : null}
    </>
  )
  return (
    <TableCell className={className} title={text}>
      {cell?.href ? (
        <Link href={cell.href} className={cn(LINK, 'inline-flex max-w-full items-center')}>
          <span className={cn(!numeric && 'truncate')}>{body}</span>
        </Link>
      ) : (
        body
      )}
    </TableCell>
  )
}
