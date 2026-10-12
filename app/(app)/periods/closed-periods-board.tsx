'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import type { ClosureKind, ClosureRow } from '@/lib/period-closures'

const KIND_LABEL: Record<ClosureKind, string> = {
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
}

export function ClosedPeriodsBoard({ rows }: { rows: ClosureRow[] }) {
  const [kind, setKind] = useState<'all' | ClosureKind>('all')
  const [year, setYear] = useState<'all' | string>('all')

  const years = useMemo(
    () => [...new Set(rows.map((row) => row.fiscalYear))].sort((a, b) => b - a),
    [rows],
  )

  const filtered = rows.filter((row) => {
    if (kind !== 'all' && row.kind !== kind) return false
    if (year !== 'all' && String(row.fiscalYear) !== year) return false
    return true
  })

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No months or years have been closed yet. Close a month below to lock posting into it.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Kind</p>
          <NativeSelect
            className="w-36"
            value={kind}
            onChange={(event) => setKind(event.target.value as 'all' | ClosureKind)}
          >
            <option value="all">All</option>
            <option value="month">Months</option>
            <option value="quarter">Quarters</option>
            <option value="year">Years</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Fiscal year</p>
          <NativeSelect
            className="w-36"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="ledger-head hover:bg-[var(--band)]">
            <TableHead className="w-24">Kind</TableHead>
            <TableHead>Close</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-40">Reports</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row, index) => {
            const qs = new URLSearchParams({
              period: 'custom',
              from: row.from,
              to: row.to,
              asOf: row.to,
            }).toString()
            return (
              <TableRow
                key={row.id}
                className={index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row'}
              >
                <TableCell className="text-muted-foreground">{KIND_LABEL[row.kind]}</TableCell>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {formatDate(row.from)} — {formatDate(row.to)}
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === 'LOCKED' ? 'secondary' : 'warning'}>
                    {row.status.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-sm">
                  <Link
                    href={`/reports/profit-loss?${qs}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    P&amp;L
                  </Link>
                  <Link
                    href={`/reports/balance-sheet?${qs}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Balance sheet
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
