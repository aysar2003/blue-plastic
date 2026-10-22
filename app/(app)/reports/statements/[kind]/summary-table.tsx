'use client'

import { useMemo } from 'react'

import { ReportRowStyleControls, useReportSheetTemplate } from '@/components/reports/report-sheet'
import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import { type CalendarDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'

const COLUMN_KEY = 'bp.statementSummaryColumns'

const COLUMNS = [
  { id: 'date', label: 'Date' },
  { id: 'number', label: 'Number' },
  { id: 'due', label: 'Due' },
  { id: 'amount', label: 'Amount' },
  { id: 'debit', label: 'Debit' },
  { id: 'credit', label: 'Credit' },
  { id: 'total', label: 'Total' },
  { id: 'balance', label: 'Current balance' },
] as const

type ColumnId = (typeof COLUMNS)[number]['id']

const DEFAULT_COLUMNS: ColumnId[] = ['date', 'number', 'due', 'debit', 'credit', 'amount', 'total', 'balance']

export type SummaryRow = {
  id: string
  number: string
  date: string
  dueDate: string | null
  /** This document's amount. A payment is the amount paid. */
  amount: string
  debit: string
  credit: string
}

function shortDate(iso: string): string {
  const day = iso.slice(0, 10)
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${day}T00:00:00Z`),
  )
}

function readColumns(raw: string | null): ColumnId[] {
  if (!raw) return DEFAULT_COLUMNS
  const known = new Set(COLUMNS.map((column) => column.id))
  const picked = raw.split(',').filter((id): id is ColumnId => known.has(id as ColumnId))
  return picked.length > 0 ? picked : DEFAULT_COLUMNS
}

function signed(value: Decimal, currency: string): string {
  if (value.isZero()) return formatMoney(ZERO, currency)
  return `${value.isNegative() ? '−' : '+'}${formatMoney(value.abs(), currency)}`
}

/** Standard, Compact, Plain and the column picker. They sit beside the title. */
export function SummaryToolbar({ numberLabel }: { numberLabel: string }) {
  const stored = useBrowserStore(COLUMN_KEY)
  const columns = readColumns(stored)
  const toggle = (id: ColumnId) => {
    const next = columns.includes(id) ? columns.filter((column) => column !== id) : [...columns, id]
    const ordered = COLUMNS.map((column) => column.id).filter((column) => next.includes(column))
    writeBrowserStore(COLUMN_KEY, ordered.join(','))
  }
  return (
    <div className="mt-3 flex flex-col items-end gap-2 print:hidden">
      <ReportRowStyleControls />
      <details className="text-left text-sm">
        <summary className="cursor-pointer text-muted-foreground">Columns</summary>
        <div className="mt-2 flex max-w-xs flex-wrap justify-end gap-x-3 gap-y-1">
          {COLUMNS.map((column) => (
            <label key={column.id} className="flex items-center gap-1.5">
              <input type="checkbox" checked={columns.includes(column.id)} onChange={() => toggle(column.id)} />
              {column.id === 'number' ? numberLabel : column.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}

/**
 * Amount is this document. Debit adds it. Credit (what was paid) is taken off.
 * Total is the invoices so far. Current balance is debit so far minus credit so far.
 */
export function SummaryTable({
  rows,
  currency,
  accent,
  wash,
  numberLabel,
  opening,
  asOf,
}: {
  rows: SummaryRow[]
  currency: string
  accent: string
  wash: string
  numberLabel: string
  closing: string
  /** Balance on the books before the first row. The running balance starts here. */
  opening: string
  asOf: CalendarDate
}) {
  const stored = useBrowserStore(COLUMN_KEY)
  const columns = readColumns(stored)
  const density = useReportSheetTemplate()
  const pad = density === 'compact' ? 'py-0.5' : 'py-1.5'
  const zebra = density === 'plain' || density === 'lined' ? '#ffffff' : wash
  const rule = density === 'lined' ? 'border-b border-[#d7dee4]' : ''

  const visible = COLUMNS.filter((column) => columns.includes(column.id))
  const template = visible
    .map((column) => (column.id === 'number' ? 'minmax(0,1fr)' : column.id === 'balance' ? '8.5rem' : '6.2rem'))
    .join(' ')

  const prepared = useMemo(() => {
    const brought = new Decimal(opening)
    const forward = [
      {
        row: {
          id: 'brought-forward',
          number: 'Brought forward',
          date: '',
          dueDate: null,
          amount: '0',
          debit: '0',
          credit: '0',
        } satisfies SummaryRow,
        amount: ZERO,
        debit: ZERO,
        credit: ZERO,
        invoices: ZERO,
        current: brought,
      },
    ]
    let invoices = ZERO
    let current = brought
    const lines = rows.map((row) => {
      const amount = new Decimal(row.amount)
      const debit = new Decimal(row.debit)
      const credit = new Decimal(row.credit)
      invoices = invoices.plus(debit)
      current = current.plus(debit).minus(credit)
      return { row, amount, debit, credit, invoices, current }
    })
    return [...forward, ...lines]
  }, [rows, opening])

  const totals = prepared.reduce(
    (sum, line) => ({
      amount: sum.amount.plus(line.debit),
      credit: sum.credit.plus(line.credit),
      balance: line.current,
    }),
    { amount: ZERO, credit: ZERO, balance: ZERO },
  )

  const cell = (id: ColumnId, line: (typeof prepared)[number]) => {
    if (id === 'date') return line.row.date ? shortDate(line.row.date) : '—'
    if (id === 'number') return line.row.number
    if (id === 'due') return line.row.dueDate ? shortDate(line.row.dueDate) : '—'
    if (id === 'amount') return formatMoney(line.amount, currency)
    if (id === 'debit') return formatMoney(line.debit, currency)
    if (id === 'credit') return formatMoney(line.credit, currency)
    if (id === 'total') return formatMoney(line.invoices, currency)
    return signed(line.current, currency)
  }

  return (
    <div className="mt-6">
      <div
        className={`grid px-2 text-[11px] font-bold uppercase tracking-wide text-white ${pad}`}
        style={{ background: accent, gridTemplateColumns: template }}
      >
        {visible.map((column) => (
          <span key={column.id} className={column.id === 'date' || column.id === 'number' || column.id === 'due' ? '' : 'text-right'}>
            {column.id === 'number' ? numberLabel : column.label}
          </span>
        ))}
      </div>
      {prepared.map((line, index) => (
        <div
          key={line.row.id}
          className={`grid items-center px-2 text-[12px] ${pad} ${rule}`}
          style={{ background: index % 2 === 0 ? '#ffffff' : zebra, gridTemplateColumns: template }}
        >
          {visible.map((column) => (
            <span
              key={column.id}
              className={
                column.id === 'number'
                  ? 'truncate pr-2'
                  : column.id === 'date' || column.id === 'due'
                    ? 'tabular'
                    : column.id === 'balance'
                      ? 'tabular text-right font-semibold'
                      : 'tabular text-right'
              }
              style={
                column.id === 'balance'
                  ? { color: '#1f2933' }
                  : column.id === 'credit' && line.credit.greaterThan('0.004')
                    ? { color: '#9f1239' }
                    : undefined
              }
            >
              {column.id === 'number' ? (
                <a href={`#invoice-${line.row.id}`} className="underline-offset-4 hover:underline print:no-underline">
                  {line.row.number}
                </a>
              ) : (
                cell(column.id, line)
              )}
            </span>
          ))}
        </div>
      ))}
      <div
        className="grid border-t-2 px-2 py-2 text-[12px] font-bold"
        style={{ borderColor: accent, color: accent, gridTemplateColumns: template }}
      >
        {visible.map((column, index) => (
          <span key={column.id} className={index === 0 ? '' : 'tabular text-right'}>
            {index === 0
              ? 'Total'
              : column.id === 'amount' || column.id === 'debit'
                ? formatMoney(totals.amount, currency)
                : column.id === 'credit'
                  ? formatMoney(totals.credit, currency)
                  : column.id === 'total'
                    ? formatMoney(totals.amount, currency)
                    : column.id === 'balance'
                      ? signed(totals.balance, currency)
                      : ''}
          </span>
        ))}
      </div>
      <div className="ml-auto mt-6 w-full max-w-xs text-[12px] text-white">
        <div className="flex justify-between gap-4 px-2 py-1" style={{ background: accent }}>
          <span>Brought forward</span>
          <span className="tabular">{signed(new Decimal(opening), currency)}</span>
        </div>
        <div className="flex justify-between gap-4 px-2 py-1" style={{ background: accent }}>
          <span>Total debit</span>
          <span className="tabular">{formatMoney(totals.amount, currency)}</span>
        </div>
        <div className="flex justify-between gap-4 px-2 py-1" style={{ background: accent }}>
          <span>Total credit</span>
          <span className="tabular">{formatMoney(totals.credit, currency)}</span>
        </div>
        <div className="flex justify-between gap-4 px-2 py-1 font-bold" style={{ background: accent }}>
          <span>Balance {shortDate(asOf)}</span>
          <span className="tabular">
            {signed(new Decimal(opening).plus(totals.amount).minus(totals.credit), currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
