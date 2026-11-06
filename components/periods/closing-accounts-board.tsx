'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  CLOSING_KIND_LABEL,
  type ClosingAccountKind,
  type ClosingAccountsBoard,
} from '@/lib/closing-accounts'
import { formatMoney } from '@/lib/money'

type KindFilter = 'all' | ClosingAccountKind

/**
 * Filterable view of the accounts a year-end close sweeps (preview or posted
 * closing journal). Year, kind, and text search are client-side so the bookkeeper
 * can inspect before confirming, or audit after the year is locked.
 */
export function ClosingAccountsBoard({ boards }: { boards: ClosingAccountsBoard[] }) {
  const [yearId, setYearId] = useState(boards[0]?.fiscalYearId ?? '')
  const [kind, setKind] = useState<KindFilter>('all')
  const [q, setQ] = useState('')

  const board = useMemo(
    () => boards.find((item) => item.fiscalYearId === yearId) ?? boards[0] ?? null,
    [boards, yearId],
  )

  const filtered = useMemo(() => {
    if (!board) return []
    const needle = q.trim().toLowerCase()
    return board.rows.filter((row) => {
      if (kind !== 'all' && row.kind !== kind) return false
      if (!needle) return true
      return (
        row.code.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle) ||
        CLOSING_KIND_LABEL[row.kind].toLowerCase().includes(needle)
      )
    })
  }, [board, kind, q])

  if (boards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No year-end closing accounts to show yet. When a fiscal year has finished (or has been
        closed), its revenue, expense, and Retained Earnings lines appear here.
      </p>
    )
  }

  if (!board) return null

  const currency = board.currency

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Fiscal year</p>
          <NativeSelect
            className="w-44"
            value={board.fiscalYearId}
            onChange={(event) => setYearId(event.target.value)}
          >
            {boards.map((item) => (
              <option key={item.fiscalYearId} value={item.fiscalYearId}>
                {item.year}
                {item.mode === 'preview' ? ' (preview)' : ' (closed)'}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Account kind</p>
          <NativeSelect
            className="w-44"
            value={kind}
            onChange={(event) => setKind(event.target.value as KindFilter)}
          >
            <option value="all">All kinds</option>
            <option value="REVENUE">Revenue</option>
            <option value="COGS">Cost of goods</option>
            <option value="EXPENSE">Expense</option>
            <option value="EQUITY">Retained earnings</option>
          </NativeSelect>
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Search</p>
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Code or name…"
            aria-label="Filter closing accounts by code or name"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={board.mode === 'posted' ? 'secondary' : 'warning'}>
          {board.mode === 'posted' ? 'Posted close' : 'Preview — not posted yet'}
        </Badge>
        <span className="text-muted-foreground">
          Net income → {board.retainedEarningsName}:{' '}
          <span className="font-medium tabular text-foreground">
            {formatMoney(board.netIncome, currency)}
          </span>
        </span>
        {board.journalNumber ? (
          <Link
            href={`/journals?q=${encodeURIComponent(board.journalNumber)}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {board.journalNumber}
          </Link>
        ) : null}
        <span className="text-muted-foreground">
          Showing {filtered.length} of {board.rows.length}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="ledger-head hover:bg-[var(--band)]">
            <TableHead className="w-24">Code</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="w-36">Kind</TableHead>
            <TableHead className="numeric w-32">Close debit</TableHead>
            <TableHead className="numeric w-32">Close credit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground">
                No accounts match this filter.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row, index) => (
              <TableRow
                key={`${row.accountId}-${row.kind}-${index}`}
                className={index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row'}
              >
                <TableCell className="tabular text-muted-foreground">{row.code}</TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {CLOSING_KIND_LABEL[row.kind]}
                </TableCell>
                <TableCell className="numeric tabular">
                  {Number(row.closeDebit) === 0 ? '—' : formatMoney(row.closeDebit, currency)}
                </TableCell>
                <TableCell className="numeric tabular">
                  {Number(row.closeCredit) === 0 ? '—' : formatMoney(row.closeCredit, currency)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
