'use client'

import { useMemo } from 'react'

import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'

const COLUMNS: InteractiveColumn[] = [
  { id: 'number', label: 'Number', defaultWidth: 110 },
  { id: 'kind', label: 'Kind', defaultWidth: 110 },
  { id: 'date', label: 'Date', kind: 'date', defaultWidth: 120 },
  { id: 'expiry', label: 'Expires', kind: 'date', defaultWidth: 120 },
  { id: 'status', label: 'Status', defaultWidth: 110 },
  { id: 'total', label: 'Total', kind: 'money', total: true, defaultWidth: 112 },
  { id: 'pdf', label: 'PDF', defaultWidth: 72 },
]

function statusLabel(status: string) {
  switch (status) {
    case 'ACCEPTED':
      return 'Accepted'
    case 'DECLINED':
      return 'Declined'
    case 'CLOSED':
      return 'Converted'
    case 'OPEN':
      return 'Open'
    case 'PENDING_APPROVAL':
      return 'Pending'
    default:
      return status
  }
}

export type PortalQuoteRow = {
  id: string
  number: string
  kind: string
  date: string
  expiryDate: string | null
  status: string
  total: string
}

export function PortalQuotesTable({
  rows,
  currency,
}: {
  rows: PortalQuoteRow[]
  currency: string
}) {
  const gridRows = useMemo<InteractiveRow[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        cells: {
          number: {
            value: row.number,
            href: `/portal/quotes/${row.id}`,
          },
          kind: { value: row.kind },
          date: { value: row.date },
          expiry: { value: row.expiryDate },
          status: {
            value: statusLabel(row.status),
            sort: row.status,
          },
          total: { value: row.total },
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
      storageKey="bp-portal-quotes-columns-v1"
      columns={COLUMNS}
      rows={gridRows}
      currency={currency}
      customizable
      showTotal
      totalLabel="Total"
      initialSort={{ id: 'date', dir: 'desc' }}
      note="Estimates and quotations sent to this account. Sort, drag, or Customize to change what shows."
    />
  )
}
