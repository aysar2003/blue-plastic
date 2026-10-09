'use client'

import { useMemo } from 'react'

import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'
import {
  buildRegisterColumns,
  storageKeyForRegister,
  type RegisterColumnDef,
} from '@/lib/register-table-columns'

export type RegisterTableRow = {
  lineId: string
  journalNumber: string
  /** ISO timestamp of when the journal was recorded. */
  recordedAt: string
  status: string
  sourceLabel: string
  /** The source document, or the journal when the entry has no document. */
  typeHref: string | null
  entryHref: string
  /** Till register name when this row came from POS; sourceLabel already says "(POS)". */
  posRegisterName?: string | null
  isPos?: boolean
  name: string | null
  nameHref: string | null
  note: string | null
  docNumber: string | null
  docHref: string | null
  contraAccounts: string
  splits: { code: string; name: string; amount: string }[]
  debit: string
  credit: string
  balance: string
}

type Props = {
  accountId: string
  currency: string
  timeZone: string
  rows: RegisterTableRow[]
  closingBalance: string
}

const WIDTHS: Record<string, number> = {
  date: 188,
  entry: 128,
  type: 148,
  name: 168,
  description: 240,
  document: 128,
  contra: 180,
  debit: 120,
  credit: 120,
  balance: 136,
}

function collectSplits(rows: RegisterTableRow[]) {
  const map = new Map<string, { code: string; name: string }>()
  for (const row of rows) {
    for (const split of row.splits) {
      if (!map.has(split.code)) map.set(split.code, { code: split.code, name: split.name })
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
}

function columnOf(col: RegisterColumnDef): InteractiveColumn {
  const split = col.kind === 'split'
  return {
    id: col.id,
    label: col.label,
    kind: col.id === 'date' ? 'datetime' : split || col.kind === 'money' ? 'money' : 'text',
    total: col.id === 'debit' || col.id === 'credit' || split,
    defaultWidth: WIDTHS[col.id] ?? (split ? 150 : 160),
  }
}

export function RegisterTable({ accountId, currency, timeZone, rows, closingBalance }: Props) {
  const splits = useMemo(() => collectSplits(rows), [rows])
  const columns = useMemo(() => buildRegisterColumns(splits).map(columnOf), [splits])

  const gridRows = useMemo<InteractiveRow[]>(
    () =>
      rows.map((row) => {
        const cells: InteractiveRow['cells'] = {
          date: { value: row.recordedAt },
          entry: {
            value: row.journalNumber,
            href: row.entryHref,
            badge: row.status === 'REVERSED' ? 'reversed' : null,
          },
          type: { value: row.sourceLabel, href: row.typeHref },
          name: row.name ? { value: row.name, href: row.nameHref } : { value: null },
          description: { value: row.note },
          document: row.docNumber ? { value: row.docNumber, href: row.docHref } : { value: null },
          contra: { value: row.contraAccounts },
          debit: { value: row.debit || null },
          credit: { value: row.credit || null },
          balance: { value: row.balance },
        }
        for (const split of row.splits) {
          cells[`split:${split.code}`] = split.amount && Number(split.amount) !== 0 ? { value: split.amount } : { value: null }
        }
        return { id: row.lineId, cells }
      }),
    [rows],
  )

  return (
    <InteractiveGrid
      storageKey={storageKeyForRegister(accountId)}
      columns={columns}
      rows={gridRows}
      currency={currency}
      timeZone={timeZone}
      customizable
      totalLabel="Total"
      footers={[
        {
          id: 'closing',
          label: 'Closing balance',
          cells: { balance: { value: closingBalance } },
        },
      ]}
    />
  )
}
