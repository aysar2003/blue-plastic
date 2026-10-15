'use client'

import { useMemo } from 'react'

import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'

const COLUMNS: InteractiveColumn[] = [
  { id: 'number', label: 'Number', defaultWidth: 110 },
  { id: 'date', label: 'Date', kind: 'date', defaultWidth: 120 },
  { id: 'due', label: 'Due', kind: 'date', defaultWidth: 120 },
  { id: 'status', label: 'Status', defaultWidth: 110 },
  { id: 'total', label: 'Total', kind: 'money', total: true, defaultWidth: 112 },
  { id: 'paid', label: 'Paid', kind: 'money', total: true, defaultWidth: 112 },
  { id: 'balance', label: 'Balance', kind: 'money', total: true, defaultWidth: 112 },
  { id: 'pdf', label: 'PDF', defaultWidth: 72 },
]

function statusLabel(status: string) {
  switch (status) {
    case 'PAID':
      return 'Paid'
    case 'PARTIAL':
      return 'Partly paid'
    case 'OVERDUE':
      return 'Overdue'
    case 'OPEN':
      return 'Unpaid'
    default:
      return status
  }
}

export type PortalInvoiceRow = {
  id: string
  number: string
  date: string
  dueDate: string | null
  status: string
  total: string
  paid: string
  balance: string
}

/** Portal invoices list: sort, drag columns, Customize show/hide. */
export function PortalInvoicesTable({
  rows,
  currency,
}: {
  rows: PortalInvoiceRow[]
  currency: string
}) {
  const gridRows = useMemo<InteractiveRow[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        cells: {
          number: {
            value: row.number,
            href: `/portal/invoices/${row.id}`,
          },
          date: { value: row.date },
          due: { value: row.dueDate },
          status: {
            value: statusLabel(row.status),
            sort: row.status,
          },
          total: { value: row.total },
          paid: { value: row.paid },
          balance: { value: row.balance },
          pdf: {
            value: 'PDF',
            href: `/api/sales/${row.id}/pdf`,
          },
        },
      })),
    [rows],
  )

  return (
    <InteractiveGrid
      storageKey="bp-portal-invoices-columns-v1"
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
