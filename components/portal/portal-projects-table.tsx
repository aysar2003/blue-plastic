'use client'

import { useMemo } from 'react'

import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'

const COLUMNS: InteractiveColumn[] = [
  { id: 'number', label: 'Number', defaultWidth: 110 },
  { id: 'name', label: 'Name', defaultWidth: 220 },
  { id: 'site', label: 'Site', defaultWidth: 180 },
  { id: 'status', label: 'Status', defaultWidth: 110 },
  { id: 'start', label: 'Start', kind: 'date', defaultWidth: 120 },
  { id: 'end', label: 'End', kind: 'date', defaultWidth: 120 },
]

export type PortalProjectRow = {
  id: string
  number: string
  name: string
  status: string
  statusLabel: string
  siteLocation: string | null
  startDate: string | null
  endDate: string | null
}

export function PortalProjectsTable({
  rows,
  currency,
}: {
  rows: PortalProjectRow[]
  currency: string
}) {
  const gridRows = useMemo<InteractiveRow[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        cells: {
          number: { value: row.number },
          name: { value: row.name },
          site: { value: row.siteLocation },
          status: {
            value: row.statusLabel,
            sort: row.status,
          },
          start: { value: row.startDate },
          end: { value: row.endDate },
        },
      })),
    [rows],
  )

  return (
    <InteractiveGrid
      storageKey="bp-portal-projects-columns-v1"
      columns={COLUMNS}
      rows={gridRows}
      currency={currency}
      customizable
      initialSort={{ id: 'number', dir: 'desc' }}
      note="Jobs on this account. Sort, drag, or Customize to change what shows."
    />
  )
}
