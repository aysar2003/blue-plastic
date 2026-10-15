'use client'

import { useMemo } from 'react'

import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'

const COLUMNS: InteractiveColumn[] = [
  { id: 'number', label: 'Number', defaultWidth: 160 },
  { id: 'date', label: 'Date', kind: 'date', defaultWidth: 120 },
  { id: 'method', label: 'Method', defaultWidth: 110 },
  { id: 'reference', label: 'Reference', defaultWidth: 160 },
  { id: 'invoices', label: 'Invoices', defaultWidth: 200 },
  { id: 'amount', label: 'Amount', kind: 'money', total: true, defaultWidth: 112 },
]

export type PortalPaymentRow = {
  id: string
  number: string
  date: string
  method: string
  reference: string | null
  amount: string
  invoices: { id: string; number: string }[]
}

/** Portal payments list: sort, drag columns, Customize show/hide. */
export function PortalPaymentsTable({
  rows,
  currency,
}: {
  rows: PortalPaymentRow[]
  currency: string
}) {
  const gridRows = useMemo<InteractiveRow[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        cells: {
          number: { value: row.number },
          date: { value: row.date },
          method: { value: row.method.replaceAll('_', ' ') },
          reference: { value: row.reference },
          invoices: {
            value: row.invoices.length
              ? row.invoices.map((invoice) => invoice.number).join(', ')
              : 'Unapplied',
          },
          amount: { value: row.amount },
        },
      })),
    [rows],
  )

  return (
    <InteractiveGrid
      storageKey="bp-portal-payments-columns-v1"
      columns={COLUMNS}
      rows={gridRows}
      currency={currency}
      customizable
      showTotal
      totalLabel="Total"
      initialSort={{ id: 'date', dir: 'desc' }}
      note="On a phone, extra columns sit under each row. Sort, drag, or Customize to change what shows."
    />
  )
}
