import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import type { AccountType } from '@prisma/client'

import { AccountTypeIcon } from '@/components/accounts/account-type-icon'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { ClickableRow } from '@/components/reports/clickable-row'
import { RowGroup } from '@/components/reports/row-group'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import {
  ACCOUNT_SUBTYPE_LABELS,
  ACCOUNT_SUBTYPE_ORDER,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
} from '@/lib/accounting-labels'
import { chartSubIndentPadStyle, childDisplayName } from '@/lib/chart-tree'
import { Decimal, formatMoney } from '@/lib/money'
import { REPORT_DRILL_LINK } from '@/lib/report-drill'
import { cn } from '@/lib/utils'
import type { StatementRow, StatementSection } from '@/server/reports/statements'

export type StatementColumn = { label: string; comparison?: boolean }

export const STATEMENT_SORT_COLUMNS = [
  'account',
  'type',
  'detail',
  'amount',
  'comparison',
  'change',
  'percent',
] as const

export type StatementSortColumn = (typeof STATEMENT_SORT_COLUMNS)[number]

const TYPE_RANK = new Map(ACCOUNT_TYPE_ORDER.map((type, index) => [type, index]))
const SUBTYPE_RANK = new Map(ACCOUNT_SUBTYPE_ORDER.map((subtype, index) => [subtype, index]))

/**
 * Sort siblings while keeping every sub-account glued under its main. Default
 * detail-type order matches the chart: Bank with Bank, Inventory with Inventory.
 */
export function sortStatementRows(rows: StatementRow[], sort: SortState): StatementRow[] {
  type Node = { row: StatementRow; children: Node[] }
  const nodes = new Map<string, Node>()
  for (const row of rows) nodes.set(row.accountId, { row, children: [] })

  const roots: Node[] = []
  for (const row of rows) {
    const node = nodes.get(row.accountId)!
    const parent = row.parentId ? nodes.get(row.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sign = sort.dir === 'asc' ? 1 : -1
  const byCode = (a: StatementRow, b: StatementRow) => a.code.localeCompare(b.code)
  const compare = (a: Node, b: Node) => {
    const left = a.row
    const right = b.row
    let delta = 0
    switch (sort.sort) {
      case 'type':
        delta =
          (TYPE_RANK.get(left.type) ?? 99) - (TYPE_RANK.get(right.type) ?? 99) ||
          left.type.localeCompare(right.type)
        break
      case 'detail':
        delta =
          (SUBTYPE_RANK.get(left.subtype) ?? 99) - (SUBTYPE_RANK.get(right.subtype) ?? 99) ||
          ACCOUNT_SUBTYPE_LABELS[left.subtype].localeCompare(ACCOUNT_SUBTYPE_LABELS[right.subtype])
        break
      case 'amount':
        delta = left.amount.comparedTo(right.amount)
        break
      case 'comparison':
        delta = (left.comparison ?? new Decimal(0)).comparedTo(right.comparison ?? new Decimal(0))
        break
      case 'change':
        delta = left.amount
          .minus(left.comparison ?? new Decimal(0))
          .comparedTo(right.amount.minus(right.comparison ?? new Decimal(0)))
        break
      case 'percent':
        delta = (left.percentOfIncome ?? new Decimal(0)).comparedTo(
          right.percentOfIncome ?? new Decimal(0),
        )
        break
      case 'account':
      default:
        delta = byCode(left, right) || left.name.localeCompare(right.name)
        break
    }
    if (delta !== 0) return sign * delta
    return byCode(left, right)
  }

  const sortNodes = (list: Node[]) => {
    list.sort(compare)
    for (const node of list) sortNodes(node.children)
  }
  sortNodes(roots)

  const ordered: StatementRow[] = []
  const walk = (list: Node[], depth: number) => {
    for (const node of list) {
      ordered.push({ ...node.row, depth })
      walk(node.children, depth + 1)
    }
  }
  walk(roots, 0)
  return ordered
}

/**
 * The rendering shared by the profit and loss and the balance sheet: sections of
 * accounts, each with a total, and a running set of subtotal lines between them.
 *
 * Column headers sort in the URL (same pattern as other reports). Sub-accounts
 * stay under their main account in every ordering.
 */
export function StatementTable({
  sections,
  currency,
  drillTo,
  showPercent,
  comparisonLabel,
  subtotals = {},
  sort,
  basePath,
  linkParams = {},
}: {
  sections: StatementSection[]
  currency: string
  /** Builds the account link; omitted where a drill-down has no meaning. */
  drillTo?: (accountId: string) => string
  showPercent?: boolean
  comparisonLabel?: string
  /** Rendered after the section with the matching key. */
  subtotals?: Record<
    string,
    { label: string; amount: Decimal; comparison?: Decimal; emphasis?: boolean; href?: string }[]
  >
  sort: SortState
  basePath: string
  linkParams?: Record<string, string | undefined>
}) {
  // Account · Type · Detail type · Amount · [comparison · change] · [%]
  const columns = 4 + (showPercent ? 1 : 0) + (comparisonLabel ? 2 : 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            column="account"
            label="Account"
            state={sort}
            basePath={basePath}
            params={linkParams}
          />
          <SortableHeader
            column="type"
            label="Type"
            state={sort}
            basePath={basePath}
            params={linkParams}
            className="w-36"
          />
          <SortableHeader
            column="detail"
            label="Detail type"
            state={sort}
            basePath={basePath}
            params={linkParams}
            className="w-44"
          />
          <SortableHeader
            column="amount"
            label="Amount"
            state={sort}
            basePath={basePath}
            params={linkParams}
            className="numeric w-40"
            numeric
            defaultDirection="desc"
          />
          {comparisonLabel ? (
            <SortableHeader
              column="comparison"
              label={comparisonLabel}
              state={sort}
              basePath={basePath}
              params={linkParams}
              className="numeric w-40"
              numeric
              defaultDirection="desc"
            />
          ) : null}
          {comparisonLabel ? (
            <SortableHeader
              column="change"
              label="Change"
              state={sort}
              basePath={basePath}
              params={linkParams}
              className="numeric w-36"
              numeric
              defaultDirection="desc"
            />
          ) : null}
          {showPercent ? (
            <SortableHeader
              column="percent"
              label="% of income"
              state={sort}
              basePath={basePath}
              params={linkParams}
              className="numeric w-24"
              numeric
              defaultDirection="desc"
            />
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sections.map((section) => (
          <SectionRows
            key={section.key}
            section={{ ...section, rows: sortStatementRows(section.rows, sort) }}
            currency={currency}
            drillTo={drillTo}
            showPercent={showPercent}
            hasComparison={Boolean(comparisonLabel)}
            columns={columns}
            subtotals={subtotals[section.key] ?? []}
          />
        ))}
      </TableBody>
    </Table>
  )
}

function typeHref(type: AccountType) {
  return `/accounts?type=${type}`
}

function cluster(rows: StatementSection['rows']) {
  const groups: { key: string; title: string | null; rows: StatementSection['rows'] }[] = []
  for (const row of rows) {
    const title = row.group || null
    const last = groups[groups.length - 1]
    if (title && last?.title === title) last.rows.push(row)
    else groups.push({ key: title ?? row.accountId, title, rows: [row] })
  }
  return groups
}

function SectionRows({
  section,
  currency,
  drillTo,
  showPercent,
  hasComparison,
  columns,
  subtotals,
}: {
  section: StatementSection
  currency: string
  drillTo?: (accountId: string) => string
  showPercent?: boolean
  hasComparison: boolean
  columns: number
  subtotals: { label: string; amount: Decimal; comparison?: Decimal; emphasis?: boolean; href?: string }[]
}) {
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={columns} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {section.label}
        </TableCell>
      </TableRow>

      {section.rows.length === 0 ? (
        <TableRow>
          <TableCell colSpan={columns} className="py-3 pl-6 text-sm text-muted-foreground">
            Nothing in this section.
          </TableCell>
        </TableRow>
      ) : (
        cluster(section.rows).map((group) => {
          const nameById = new Map(section.rows.map((row) => [row.accountId, row.name]))
          const lines = group.rows.map((row) => {
            const depth = row.depth ?? 0
            const href = drillTo?.(row.accountId)
            const label = childDisplayName(
              row.name,
              row.parentId ? nameById.get(row.parentId) : null,
            )
            const accountLabel = (
              <>
                <span className="tabular opacity-70">{row.code}</span> {label}
              </>
            )
            return (
            <ClickableRow
              key={row.accountId}
              href={href}
              title={href ? 'Open transactions for this account' : undefined}
              className={cn(depth === 0 && section.rows.some((other) => other.parentId === row.accountId) && 'font-medium')}
            >
              <TableCell className="pl-6">
                <span
                  className={cn(
                    'block',
                    depth > 0 && 'relative border-l-2 border-primary/35 pl-3',
                  )}
                  style={chartSubIndentPadStyle(depth)}
                >
                  {href ? (
                    <Link href={href} className={REPORT_DRILL_LINK}>
                      {accountLabel}
                    </Link>
                  ) : (
                    accountLabel
                  )}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <Link
                  href={typeHref(row.type)}
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
                  title={`Open ${ACCOUNT_TYPE_LABELS[row.type]} accounts`}
                >
                  <AccountTypeIcon type={row.type} size="sm" />
                  {ACCOUNT_TYPE_LABELS[row.type]}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {ACCOUNT_SUBTYPE_LABELS[row.subtype]}
              </TableCell>
              <TableCell className="numeric tabular">
                {href ? (
                  <Link href={href} className={REPORT_DRILL_LINK}>
                    {formatMoney(row.amount, currency)}
                  </Link>
                ) : (
                  formatMoney(row.amount, currency)
                )}
              </TableCell>
              {hasComparison ? (
                <TableCell className="numeric tabular text-muted-foreground">
                  {href ? (
                    <Link href={href} className={REPORT_DRILL_LINK}>
                      {formatMoney(row.comparison ?? new Decimal(0), currency)}
                    </Link>
                  ) : (
                    formatMoney(row.comparison ?? new Decimal(0), currency)
                  )}
                </TableCell>
              ) : null}
              {hasComparison ? (
                <TableCell className="numeric tabular">
                  {href ? (
                    <Link href={href} className={REPORT_DRILL_LINK}>
                      {formatMoney(row.amount.minus(row.comparison ?? new Decimal(0)), currency)}
                    </Link>
                  ) : (
                    formatMoney(row.amount.minus(row.comparison ?? new Decimal(0)), currency)
                  )}
                </TableCell>
              ) : null}
              {showPercent ? (
                <TableCell className="numeric tabular text-muted-foreground">
                  {row.percentOfIncome ? `${row.percentOfIncome.toFixed(1)}%` : '—'}
                </TableCell>
              ) : null}
            </ClickableRow>
            )
          })
          return group.title ? (
            <RowGroup key={group.key} title={group.title} columns={columns}>
              {lines}
            </RowGroup>
          ) : (
            <Fragment key={group.key}>{lines}</Fragment>
          )
        })
      )}

      <TableRow className="border-t">
        <TableCell className="pl-6 font-medium">Total {section.label.toLowerCase()}</TableCell>
        <TableCell />
        <TableCell />
        <TableCell className="numeric tabular font-medium">{formatMoney(section.total, currency)}</TableCell>
        {hasComparison ? (
          <TableCell className="numeric tabular font-medium text-muted-foreground">
            {formatMoney(section.comparisonTotal ?? new Decimal(0), currency)}
          </TableCell>
        ) : null}
        {hasComparison ? (
          <TableCell className="numeric tabular font-medium">
            {formatMoney(section.total.minus(section.comparisonTotal ?? new Decimal(0)), currency)}
          </TableCell>
        ) : null}
        {showPercent ? <TableCell /> : null}
      </TableRow>

      {subtotals.map((subtotal) => {
        const cell = (children: ReactNode, className: string) =>
          subtotal.href ? (
            <Link href={subtotal.href} className={`${className} underline-offset-4 hover:underline`}>
              {children}
            </Link>
          ) : (
            <span className={className}>{children}</span>
          )
        const weight = subtotal.emphasis ? 'font-semibold' : 'font-medium'
        return (
          <ClickableRow
            key={subtotal.label}
            href={subtotal.href}
            className={subtotal.emphasis ? 'ledger-head hover:bg-[var(--band)]' : 'hover:bg-muted/30'}
          >
            <TableCell>{cell(subtotal.label, weight)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="numeric tabular">
              {cell(formatMoney(subtotal.amount, currency), weight)}
            </TableCell>
            {hasComparison ? (
              <TableCell className="numeric tabular">
                {cell(formatMoney(subtotal.comparison ?? new Decimal(0), currency), weight)}
              </TableCell>
            ) : null}
            {hasComparison ? (
              <TableCell className="numeric tabular">
                {cell(
                  formatMoney(subtotal.amount.minus(subtotal.comparison ?? new Decimal(0)), currency),
                  weight,
                )}
              </TableCell>
            ) : null}
            {showPercent ? <TableCell /> : null}
          </ClickableRow>
        )
      })}
    </>
  )
}
