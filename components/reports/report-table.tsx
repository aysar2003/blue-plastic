'use client'

import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'
import type { ReportColumn, ReportTable as ReportTableData } from '@/server/reports/catalogue'

/**
 * The renderer every table report shares.
 *
 * Columns can be sorted, dragged into a new order, and resized. The layout is
 * remembered in this browser. A row still drills into the document behind it,
 * and Type, Entry, and Document open that document directly.
 */
const LINK_KEYS = new Set(['type', 'entry', 'document', 'number', 'no', 'source'])

const SKIP_TOTAL = /^(balance|price|cost|salesprice|reorderpoint|rate|percent|share|averagecost)$/i

export function ReportTable({
  table,
  currency,
  timeZone = 'UTC',
  storageKey,
}: {
  table: ReportTableData
  currency: string
  timeZone?: string
  storageKey?: string
}) {
  if (table.rows.length === 0) {
    return (
      <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
        {table.empty ?? 'Nothing to show for this period.'}
      </div>
    )
  }

  const lead = table.columns[0]?.key
  const columns: InteractiveColumn[] = table.columns.map((column) => ({
    id: column.key,
    label: column.label,
    kind: column.kind ?? kindOf(column),
    total: column.total ?? (isNumeric(column) && !SKIP_TOTAL.test(column.key)),
    defaultWidth: widthOf(column),
  }))

  const rows: InteractiveRow[] = table.rows.map((row, index) => ({
    id: `${index}`,
    emphasis: row.emphasis,
    excludeFromTotal: row.emphasis,
    className: row.emphasis ? 'bg-muted/40' : undefined,
    cells: Object.fromEntries(
      table.columns.map((column) => {
        const value = row.cells[column.key] ?? null
        const href =
          row.cellHrefs?.[column.key] ??
          (row.href && (column.key === lead || isNumeric(column) || LINK_KEYS.has(column.key)) ? row.href : null)
        return [column.key, { value, href }]
      }),
    ),
  }))

  const explicit = table.totals
    ? [
        {
          id: 'totals',
          cells: Object.fromEntries(
            table.columns.map((column) => [column.key, { value: table.totals?.[column.key] ?? null }]),
          ),
        },
      ]
    : []

  const grouped = table.rows.some((row) => row.emphasis)

  return (
    <InteractiveGrid
      storageKey={storageKey ?? `bp-report-${table.columns.map((column) => column.key).join('.')}`}
      columns={columns}
      rows={rows}
      currency={currency}
      timeZone={timeZone}
      showTotal={!table.totals && !grouped}
      customizable
      footers={explicit}
      note={table.note}
    />
  )
}

function kindOf(column: ReportColumn): InteractiveColumn['kind'] {
  if (column.format === 'money') return 'money'
  if (column.format === 'number') return 'number'
  if (column.format === 'signed') return 'signed'
  if (column.format === 'datetime') return 'datetime'
  if (column.format === 'date') return 'date'
  return 'text'
}

function isNumeric(column: ReportColumn) {
  return column.format === 'money' || column.format === 'number' || column.format === 'signed'
}

function widthOf(column: ReportColumn) {
  if (column.format === 'datetime') return 188
  const match = column.width?.match(/w-(\d+)/)
  if (match) return Number(match[1]) * 4
  return kindOf(column) === 'text' ? 180 : 128
}
