'use client'

import Link from 'next/link'
import type { AccountSubtype, AccountType } from '@prisma/client'
import { Columns3Icon } from 'lucide-react'

import { AccountTypeIcon, AccountTypeMark } from '@/components/accounts/account-type-icon'
import { FontToolbarControls } from '@/components/appearance/font-controls'
import { Pagination } from '@/components/data/pagination'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SignedMoney } from '@/components/data/signed-money'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { ReportRowStyleControls, ReportSheet, useReportSheetTemplate } from '@/components/reports/report-sheet'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ACCOUNT_SUBTYPE_LABELS, ACCOUNT_TYPE_LABELS } from '@/lib/accounting-labels'
import { chartSubIndentPadStyle, chartSubIndentStyle, childDisplayName } from '@/lib/chart-tree'
import { REPORT_DRILL_LINK } from '@/lib/report-drill'
import { cn } from '@/lib/utils'
import { useTableColumnPrefs } from '@/lib/use-table-column-prefs'
import { AccountTableRow } from './account-row-actions'
import type { ParentOption } from './account-dialog'

export type ChartAccountRow = {
  id: string
  code: string
  name: string
  description: string | null
  detailType: string | null
  type: AccountType
  subtype: AccountSubtype
  parentId: string | null
  isSystem: boolean
  isActive: boolean
  balance: string
  treeDepth: number
  hasChildren: boolean
}

type ChartColumnId = 'number' | 'name' | 'type' | 'detail' | 'balance'

const CHART_COLUMNS: { id: ChartColumnId; label: string }[] = [
  { id: 'number', label: 'Number' },
  { id: 'name', label: 'Name' },
  { id: 'type', label: 'Type' },
  { id: 'detail', label: 'Detail type' },
  { id: 'balance', label: 'Balance' },
]

const SORT_OF: Record<ChartColumnId, string> = {
  number: 'code',
  name: 'name',
  type: 'type',
  detail: 'subtype',
  balance: 'balance',
}

const WIDTH: Record<ChartColumnId, string> = {
  number: 'w-28',
  name: 'min-w-[14rem]',
  type: 'w-36',
  detail: 'w-48',
  balance: 'w-40',
}

export function ChartTable({
  rows,
  parents,
  currency,
  sort,
  linkParams,
  canEdit,
  canArchive,
  canDelete,
  canReport,
  canReconcile,
  canTransact,
  today,
}: {
  rows: ChartAccountRow[]
  parents: ParentOption[]
  currency: string
  sort: SortState
  linkParams: Record<string, string | undefined>
  canEdit: boolean
  canArchive: boolean
  canDelete: boolean
  canReport: boolean
  canReconcile: boolean
  canTransact: boolean
  today: string
}) {
  const { prefs, visible, toggle } = useTableColumnPrefs('bpc.chartColumns', CHART_COLUMNS)
  const columns = visible.map((column) => column.id as ChartColumnId)
  const span = columns.length + 2
  const template = useReportSheetTemplate()
  const striped = template !== 'plain'
  const headClass = striped ? 'ledger-head hover:bg-[var(--band)]' : 'hover:bg-muted/40'
  const headCell = striped ? 'bg-[var(--band)]' : undefined

  return (
    <ReportSheet>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2 print:hidden">
        <FontToolbarControls />
        <ReportRowStyleControls />
        <details className="relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            <Columns3Icon className="size-3.5 text-muted-foreground" aria-hidden />
            Columns
          </summary>
          <div className="absolute right-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border bg-card p-2 shadow-md">
            {CHART_COLUMNS.map((column) => (
              <label
                key={column.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={!prefs.hidden.includes(column.id)}
                  onChange={() => toggle(column.id)}
                  className="size-3.5 accent-primary"
                />
                {column.label}
              </label>
            ))}
          </div>
        </details>
      </div>

      <Card className="overflow-hidden p-0">
        <ScrollSheet>
          <Table className="min-w-[52rem]">
            <TableHeader>
              <TableRow className={headClass}>
                <TableHead className={cn('w-12 print:hidden', headCell)} aria-label="Type" />
                {columns.map((column) => (
                  <SortableHeader
                    key={column}
                    column={SORT_OF[column]}
                    label={CHART_COLUMNS.find((item) => item.id === column)?.label ?? column}
                    state={sort}
                    basePath="/accounts"
                    params={linkParams}
                    className={cn(headCell, WIDTH[column])}
                    numeric={column === 'balance'}
                    defaultDirection={column === 'balance' ? 'desc' : 'asc'}
                  />
                ))}
                <TableHead className={cn('w-10', headCell)} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.flatMap((account, index) => {
                const previous = rows[index - 1]
                const openSection = !previous || previous.type !== account.type
                const depth = account.treeDepth
                const nodes = []

                if (openSection) {
                  nodes.push(
                    <TableRow
                      key={`section-${account.type}`}
                      className={cn('pointer-events-none', striped ? 'ledger-head' : 'bg-muted/40')}
                    >
                      <TableCell
                        colSpan={span}
                        className="py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-foreground"
                      >
                        <AccountTypeMark type={account.type} className="uppercase" />
                      </TableCell>
                    </TableRow>,
                  )
                }

                nodes.push(
                  <AccountTableRow
                    key={account.id}
                    className={cn(
                      striped && (index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row'),
                      !account.isActive && 'opacity-55',
                      account.hasChildren && 'font-medium',
                    )}
                    account={{
                      id: account.id,
                      code: account.code,
                      name: account.name,
                      description: account.description,
                      detailType: account.detailType,
                      type: account.type,
                      subtype: account.subtype,
                      parentId: account.parentId,
                      isSystem: account.isSystem,
                      isActive: account.isActive,
                    }}
                    parents={parents}
                    canEdit={canEdit}
                    canArchive={canArchive}
                    canDelete={canDelete}
                    canReport={canReport}
                    canReconcile={canReconcile}
                    canTransact={canTransact}
                    today={today}
                  >
                    <TableCell className="w-12 print:hidden">
                      <AccountTypeIcon type={account.type} size="sm" />
                    </TableCell>
                    {columns.map((column) => (
                      <ChartCell
                        key={column}
                        column={column}
                        account={account}
                        currency={currency}
                        depth={depth}
                        parentName={
                          account.parentId
                            ? rows.find((row) => row.id === account.parentId)?.name
                            : null
                        }
                      />
                    ))}
                  </AccountTableRow>,
                )

                return nodes
              })}
            </TableBody>
          </Table>
        </ScrollSheet>
        <Pagination total={rows.length} />
      </Card>
    </ReportSheet>
  )
}

function ChartCell({
  column,
  account,
  currency,
  depth,
  parentName,
}: {
  column: ChartColumnId
  account: ChartAccountRow
  currency: string
  depth: number
  parentName?: string | null
}) {
  if (column === 'number') {
    return (
      <TableCell className="whitespace-nowrap tabular text-muted-foreground">
        <span className="block whitespace-nowrap" style={chartSubIndentPadStyle(depth)}>
          {account.code}
        </span>
      </TableCell>
    )
  }

  if (column === 'name') {
    const label = childDisplayName(account.name, parentName)
    return (
      <TableCell className="whitespace-nowrap">
        <span
          className={cn(
            'inline-flex items-center gap-2 whitespace-nowrap',
            depth > 0 && 'relative border-l-2 border-sky-400/60 pl-3',
          )}
          style={chartSubIndentStyle(depth)}
        >
          {depth > 0 ? (
            <span className="shrink-0 text-muted-foreground" aria-hidden>
              └
            </span>
          ) : null}
          <Link
            href={`/accounts/${account.id}`}
            className={cn(
              REPORT_DRILL_LINK,
              'whitespace-nowrap',
              account.hasChildren ? 'font-semibold' : 'font-medium',
            )}
            title="Open this account"
          >
            {label}
          </Link>
          {account.isSystem ? (
            <Badge variant="secondary" className="shrink-0" title="Posted to by the system. Cannot be deleted.">
              system
            </Badge>
          ) : null}
          {account.hasChildren ? (
            <Badge
              variant="outline"
              className="shrink-0"
              title="A grouping heading; postings go to its sub-accounts."
            >
              heading
            </Badge>
          ) : null}
          {depth > 0 ? (
            <Badge variant="outline" className="shrink-0" title="Sub-account under a heading above.">
              sub
            </Badge>
          ) : null}
          {!account.isActive ? (
            <Badge variant="outline" className="shrink-0">
              archived
            </Badge>
          ) : null}
        </span>
      </TableCell>
    )
  }

  if (column === 'balance') {
    return (
      <TableCell className="numeric whitespace-nowrap">
        <Link
          href={`/accounts/${account.id}`}
          className={cn(REPORT_DRILL_LINK, 'inline-block')}
          title={
            account.hasChildren
              ? 'Total of this account and every sub-account under it — open register'
              : 'Open this account'
          }
        >
        <SignedMoney
          amount={account.balance}
          currency={currency}
          className={account.hasChildren ? 'font-semibold' : undefined}
          title={account.hasChildren ? 'Total of this account and every sub-account under it' : undefined}
        />
        </Link>
      </TableCell>
    )
  }

  return (
    <TableCell className="whitespace-nowrap text-muted-foreground">
      {column === 'type' ? ACCOUNT_TYPE_LABELS[account.type] : ACCOUNT_SUBTYPE_LABELS[account.subtype]}
    </TableCell>
  )
}
