import Link from 'next/link'

import { ClickableRow } from '@/components/reports/clickable-row'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, isCalendarDate } from '@/lib/date'
import { formatMoney, formatSignedQuantity } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { ReportColumn, ReportTable as ReportTableData } from '@/server/reports/catalogue'

/**
 * The renderer every table report shares.
 *
 * A server component: there is nothing interactive on a report except the
 * drill-down links, and shipping the figures as HTML rather than as JSON plus a
 * renderer is what makes these pages open at once.
 *
 * Money is right-aligned and tabular, dates are formatted the way the rest of
 * the application formats them, and a row with a `href` is clickable across its
 * whole width — because on a report the question after every number is "what is
 * that made of?".
 */
export function ReportTable({ table, currency }: { table: ReportTableData; currency: string }) {
  if (table.rows.length === 0) {
    return (
      <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
        {table.empty ?? 'Nothing to show for this period.'}
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {table.columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(column.width, isNumeric(column) && 'numeric')}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {table.rows.map((row, index) => (
              <ClickableRow key={index} href={row.href ?? undefined} className={row.emphasis ? 'bg-muted/40' : undefined}>
                {table.columns.map((column, columnIndex) => {
                  const value = format(row.cells[column.key] ?? null, column, currency)
                  const cellHref = row.cellHrefs?.[column.key]
                  const linked =
                    Boolean(cellHref) ||
                    (Boolean(row.href) && (columnIndex === 0 || column.format === 'money'))

                  return (
                    <TableCell
                      key={column.key}
                      className={cn(
                        isNumeric(column) && 'numeric tabular',
                        column.format === 'date' && 'tabular whitespace-nowrap',
                        row.emphasis && 'font-medium',
                      )}
                    >
                      {linked ? (
                        <Link
                          href={cellHref ?? row.href!}
                          className="underline-offset-4 hover:underline"
                        >
                          {value}
                        </Link>
                      ) : (
                        value
                      )}
                    </TableCell>
                  )
                })}
              </ClickableRow>
            ))}
          </TableBody>

          {table.totals ? (
            <TableFooter>
              <TableRow>
                {table.columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn('font-semibold', isNumeric(column) && 'numeric tabular')}
                  >
                    {format(table.totals?.[column.key] ?? null, column, currency)}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>

      {table.note ? <p className="mt-3 text-xs text-muted-foreground">{table.note}</p> : null}
    </>
  )
}

const isNumeric = (column: ReportColumn) =>
  column.format === 'money' || column.format === 'number' || column.format === 'signed'

function format(value: string | null, column: ReportColumn, currency: string): React.ReactNode {
  if (value === null || value === '') return <span className="text-muted-foreground">—</span>

  // A totals row puts a label in the first column, which is not a figure. Only
  // something that parses as one is formatted as one.
  if (column.format === 'money' && /^-?\d+(\.\d+)?$/.test(value)) {
    return formatMoney(value, currency)
  }
  if (column.format === 'signed' && /^-?\d+(\.\d+)?$/.test(value)) {
    return formatSignedQuantity(value)
  }
  if (column.format === 'date' && isCalendarDate(value)) {
    return formatDate(value)
  }
  return value
}
