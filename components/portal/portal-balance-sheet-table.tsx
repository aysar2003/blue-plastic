'use client'

import { useMemo } from 'react'

import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'

const COLUMNS: InteractiveColumn[] = [
  { id: 'date', label: 'Date', kind: 'date', defaultWidth: 120 },
  { id: 'number', label: 'No.', defaultWidth: 100 },
  { id: 'type', label: 'Type', defaultWidth: 110 },
  { id: 'description', label: 'Description', defaultWidth: 220 },
  { id: 'debit', label: 'Debit', kind: 'money', total: true, defaultWidth: 112 },
  { id: 'credit', label: 'Credit', kind: 'money', total: true, defaultWidth: 112 },
  { id: 'balance', label: 'Balance', kind: 'money', total: false, defaultWidth: 120 },
]

export type PortalBalanceSheetRow = {
  id: string
  date: string | null
  dateSort: string
  number: string
  type: string
  description: string
  debit: string
  credit: string
  balance: string
  invoiceId: string | null
  opening?: boolean
}

/** Balance sheet grid: sort, drag columns, resize wider/narrower, Customize. */
export function PortalBalanceSheetTable({
  rows,
  currency,
  closingDebit,
  closingCredit,
  closingBalance,
}: {
  rows: PortalBalanceSheetRow[]
  currency: string
  closingDebit: string
  closingCredit: string
  closingBalance: string
}) {
  const gridRows = useMemo<InteractiveRow[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        emphasis: row.opening,
        excludeFromTotal: row.opening,
        cells: {
          date: { value: row.date, sort: row.dateSort },
          number: row.invoiceId
            ? { value: row.number, href: `/portal/invoices/${row.invoiceId}` }
            : { value: row.number },
          type: { value: row.type },
          description: { value: row.description },
          debit: { value: row.debit === '0' || row.debit === '0.00' ? null : row.debit },
          credit: { value: row.credit === '0' || row.credit === '0.00' ? null : row.credit },
          balance: { value: row.balance },
        },
      })),
    [rows],
  )

  return (
    <InteractiveGrid
      storageKey="bp-portal-balance-sheet-columns-v1"
      columns={COLUMNS}
      rows={gridRows}
      currency={currency}
      customizable
      showTotal={false}
      initialSort={null}
      note="Click header to sort ↑↓. Drag grip to reorder. Drag the edge to widen or narrow. Customize shows or hides columns."
      footers={[
        {
          id: 'closing',
          label: 'Closing balance',
          cells: {
            debit: { value: closingDebit },
            credit: { value: closingCredit },
            balance: { value: closingBalance },
          },
        },
      ]}
    />
  )
}
