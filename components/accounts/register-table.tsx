'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Columns3Icon, GripVerticalIcon } from 'lucide-react'

import { ColumnBand } from '@/components/data/column-band'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  buildRegisterColumns,
  mergeRegisterPrefs,
  REGISTER_FIXED_COLUMN_IDS,
  storageKeyForRegister,
  visibleRegisterColumns,
  type RegisterColumnDef,
  type RegisterColumnId,
  type RegisterColumnPrefs,
} from '@/lib/register-table-columns'
import { partitionColumns } from '@/lib/table-fit'
import { formatMoney, money } from '@/lib/money'
import { cn } from '@/lib/utils'

export type RegisterTableRow = {
  lineId: string
  journalId: string
  journalNumber: string
  dateLabel: string
  status: string
  sourceLabel: string
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
  rows: RegisterTableRow[]
  closingBalance: string
  sort: SortState
  basePath: string
  linkParams: Record<string, string | undefined>
  balanceHeader: string
}

/** The row a person reads across. Split accounts and the contra sit on the band below. */
const REGISTER_MAIN_IDS = REGISTER_FIXED_COLUMN_IDS.filter((id) => id !== 'contra')

function collectSplits(rows: RegisterTableRow[]) {
  const map = new Map<string, { code: string; name: string }>()
  for (const row of rows) {
    for (const split of row.splits) {
      if (!map.has(split.code)) map.set(split.code, { code: split.code, name: split.name })
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
}

function readPrefs(key: string): RegisterColumnPrefs | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as RegisterColumnPrefs
    if (!parsed || !Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return null
    return parsed
  } catch {
    return null
  }
}

export function RegisterTable({
  accountId,
  currency,
  rows,
  closingBalance,
  sort,
  basePath,
  linkParams,
  balanceHeader,
}: Props) {
  const storageKey = storageKeyForRegister(accountId)
  const splits = useMemo(() => collectSplits(rows), [rows])
  const catalog = useMemo(() => buildRegisterColumns(splits), [splits])
  const allIds = useMemo(() => catalog.map((c) => c.id), [catalog])

  const [prefs, setPrefs] = useState<RegisterColumnPrefs>(() =>
    mergeRegisterPrefs(null, allIds),
  )
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [dragId, setDragId] = useState<RegisterColumnId | null>(null)

  useEffect(() => {
    setPrefs(mergeRegisterPrefs(readPrefs(storageKey), allIds))
  }, [storageKey, allIds])

  const persist = useCallback(
    (next: RegisterColumnPrefs) => {
      setPrefs(next)
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    },
    [storageKey],
  )

  const visible = useMemo(() => visibleRegisterColumns(catalog, prefs), [catalog, prefs])
  const { main, extra } = useMemo(() => partitionColumns(visible, REGISTER_MAIN_IDS), [visible])
  const balanceVisible = main.some((c) => c.id === 'balance')

  const splitAmountByRow = useMemo(() => {
    return rows.map((row) => {
      const map = new Map<string, string>()
      for (const split of row.splits) map.set(split.code, split.amount)
      return map
    })
  }, [rows])

  function toggleColumn(id: RegisterColumnId) {
    persist({
      ...prefs,
      hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((h) => h !== id) : [...prefs.hidden, id],
    })
  }

  function reorder(from: RegisterColumnId, to: RegisterColumnId) {
    if (from === to) return
    const order = [...prefs.order]
    const fromIndex = order.indexOf(from)
    const toIndex = order.indexOf(to)
    if (fromIndex < 0 || toIndex < 0) return
    order.splice(fromIndex, 1)
    order.splice(toIndex, 0, from)
    persist({ ...prefs, order })
  }

  function renderHeader(col: RegisterColumnDef) {
    switch (col.id) {
      case 'date':
        return (
          <SortableHeader
            key={col.id}
            column="date"
            label={col.label}
            state={sort}
            basePath={basePath}
            params={linkParams}
            className="w-28"
          />
        )
      case 'entry':
        return (
          <SortableHeader
            key={col.id}
            column="entry"
            label={col.label}
            state={sort}
            basePath={basePath}
            params={linkParams}
            className="w-28"
          />
        )
      case 'description':
        return (
          <SortableHeader
            key={col.id}
            column="description"
            label={col.label}
            state={sort}
            basePath={basePath}
            params={linkParams}
          />
        )
      case 'debit':
        return (
          <SortableHeader
            key={col.id}
            column="debit"
            label={col.label}
            state={sort}
            basePath={basePath}
            params={linkParams}
            className="w-32"
            numeric
            defaultDirection="desc"
          />
        )
      case 'credit':
        return (
          <SortableHeader
            key={col.id}
            column="credit"
            label={col.label}
            state={sort}
            basePath={basePath}
            params={linkParams}
            className="w-32"
            numeric
            defaultDirection="desc"
          />
        )
      case 'balance':
        return (
          <TableHead key={col.id} className="numeric w-36">
            {balanceHeader}
          </TableHead>
        )
      case 'type':
        return (
          <TableHead key={col.id} className="w-40">
            {col.label}
          </TableHead>
        )
      case 'name':
        return (
          <TableHead key={col.id} className="w-44">
            {col.label}
          </TableHead>
        )
      case 'document':
        return (
          <TableHead key={col.id} className="w-40">
            {col.label}
          </TableHead>
        )
      default:
        return (
          <TableHead key={col.id} className={cn(col.kind === 'split' && 'min-w-[8rem] max-w-[12rem]')}>
            {col.label}
          </TableHead>
        )
    }
  }

  function renderCell(row: RegisterTableRow, col: RegisterColumnDef, rowIndex: number) {
    switch (col.id) {
      case 'date':
        return (
          <TableCell key={col.id} className="tabular whitespace-nowrap text-muted-foreground">
            {row.dateLabel}
          </TableCell>
        )
      case 'entry':
        return (
          <TableCell key={col.id}>
            <Link
              href={`/journals/${row.journalId}`}
              className="tabular font-medium underline-offset-4 hover:underline"
            >
              {row.journalNumber}
            </Link>
            {row.status === 'REVERSED' ? (
              <Badge variant="outline" className="ml-1.5">
                reversed
              </Badge>
            ) : null}
          </TableCell>
        )
      case 'type':
        return (
          <TableCell key={col.id} className="whitespace-nowrap">
            {row.sourceLabel}
          </TableCell>
        )
      case 'name':
        return (
          <TableCell key={col.id} className="truncate">
            {row.name ? (
              row.nameHref ? (
                <Link href={row.nameHref} className="underline-offset-4 hover:underline">
                  {row.name}
                </Link>
              ) : (
                row.name
              )
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
        )
      case 'description':
        return (
          <TableCell key={col.id} className="text-muted-foreground">
            {row.note ?? '—'}
          </TableCell>
        )
      case 'document':
        return (
          <TableCell key={col.id}>
            {!row.docNumber ? (
              <span className="text-muted-foreground">—</span>
            ) : row.docHref ? (
              <Link href={row.docHref} className="tabular font-medium underline-offset-4 hover:underline">
                {row.docNumber}
              </Link>
            ) : (
              <span className="tabular font-medium">{row.docNumber}</span>
            )}
          </TableCell>
        )
      case 'contra':
        return (
          <TableCell key={col.id} className="text-muted-foreground">
            {row.contraAccounts}
          </TableCell>
        )
      case 'debit':
        return (
          <TableCell key={col.id} className="numeric tabular">
            {row.debit ? formatMoney(money(row.debit), currency) : ''}
          </TableCell>
        )
      case 'credit':
        return (
          <TableCell key={col.id} className="numeric tabular">
            {row.credit ? formatMoney(money(row.credit), currency) : ''}
          </TableCell>
        )
      case 'balance':
        return (
          <TableCell key={col.id} className="numeric tabular font-medium">
            {formatMoney(money(row.balance), currency)}
          </TableCell>
        )
      default: {
        const code = col.id.slice('split:'.length)
        const amount = splitAmountByRow[rowIndex]?.get(code)
        const value = amount ? money(amount) : money(0)
        return (
          <TableCell key={col.id} className="numeric tabular text-muted-foreground">
            {value.isZero() ? '' : formatMoney(value, currency)}
          </TableCell>
        )
      }
    }
  }

  function extraValue(row: RegisterTableRow, col: RegisterColumnDef, rowIndex: number) {
    if (col.id === 'contra') return row.contraAccounts
    const code = col.id.slice('split:'.length)
    const amount = splitAmountByRow[rowIndex]?.get(code)
    const value = amount ? money(amount) : money(0)
    return value.isZero() ? '' : formatMoney(value, currency)
  }

  const customizeList = prefs.order
    .map((id) => catalog.find((c) => c.id === id))
    .filter((c): c is RegisterColumnDef => Boolean(c))

  return (
    <>
      <div className="mb-2 flex justify-end print:hidden">
        <Button type="button" variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
          <Columns3Icon className="size-4" />
          Customize
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            {main.length > 0 ? <TableRow>{main.map((col) => renderHeader(col))}</TableRow> : null}
            {extra.length > 0 ? (
              <TableRow data-column-band="" className="hover:bg-transparent">
                <TableHead colSpan={Math.max(1, main.length)} className="h-auto bg-[var(--band)] py-2 normal-case tracking-normal">
                  <ColumnBand>
                    {extra.map((col) => (
                      <div
                        key={col.id}
                        className={cn(
                          'min-w-0 text-[0.65rem] font-semibold uppercase leading-tight tracking-wide',
                          col.kind !== 'text' && 'text-right',
                        )}
                      >
                        {col.label}
                      </div>
                    ))}
                  </ColumnBand>
                </TableHead>
              </TableRow>
            ) : null}
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <Fragment key={row.lineId}>
                {main.length > 0 ? (
                  <TableRow className={extra.length > 0 ? 'border-b-0' : undefined}>
                    {main.map((col) => renderCell(row, col, rowIndex))}
                  </TableRow>
                ) : null}
                {extra.length > 0 ? (
                  <TableRow data-column-band="" className="bg-muted/30 hover:bg-muted/40">
                    <TableCell colSpan={Math.max(1, main.length)} className="py-1.5">
                      <ColumnBand>
                        {extra.map((col) => (
                          <div
                            key={col.id}
                            className={cn(
                              'min-w-0 break-words text-[0.8125rem]',
                              col.kind !== 'text' && 'text-right tabular',
                            )}
                          >
                            {extraValue(row, col, rowIndex)}
                          </div>
                        ))}
                      </ColumnBand>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              {main.length === 0 ? (
                <TableCell>
                  <div className="flex items-baseline justify-between gap-4">
                    <span>Closing balance</span>
                    <span className="numeric tabular font-semibold">
                      {formatMoney(money(closingBalance), currency)}
                    </span>
                  </div>
                </TableCell>
              ) : balanceVisible ? (
                main.map((col, index) =>
                  col.id === 'balance' && index === 0 ? (
                    <TableCell key={col.id}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span>Closing balance</span>
                        <span className="numeric tabular font-semibold">
                          {formatMoney(money(closingBalance), currency)}
                        </span>
                      </div>
                    </TableCell>
                  ) : (
                    <TableCell
                      key={col.id}
                      className={col.id === 'balance' ? 'numeric tabular font-semibold' : undefined}
                    >
                      {col.id === 'balance'
                        ? formatMoney(money(closingBalance), currency)
                        : index === 0
                          ? 'Closing balance'
                          : null}
                    </TableCell>
                  ),
                )
              ) : (
                <TableCell colSpan={main.length}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span>Closing balance</span>
                    <span className="numeric tabular font-semibold">
                      {formatMoney(money(closingBalance), currency)}
                    </span>
                  </div>
                </TableCell>
              )}
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent
          size="sm"
          className={cn(
            'left-auto right-0 top-0 h-[100svh] max-h-none w-full max-w-md translate-x-0 translate-y-0 rounded-none border-l sm:top-0',
            'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          )}
        >
          <DialogHeader>
            <DialogTitle>Customize</DialogTitle>
            <DialogDescription>Drag to change column order. Check columns you want to see.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1">
            {customizeList.map((col) => {
              const checked = !prefs.hidden.includes(col.id)
              return (
                <li
                  key={col.id}
                  draggable
                  onDragStart={() => setDragId(col.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) reorder(dragId, col.id)
                    setDragId(null)
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border bg-background px-2 py-2',
                    dragId === col.id && 'opacity-60',
                  )}
                >
                  <GripVerticalIcon className="size-4 shrink-0 cursor-grab text-foreground/75" aria-hidden />
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(col.id)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
