import type { Metadata } from 'next'
import Link from 'next/link'
import { FileTextIcon, PlusIcon } from 'lucide-react'

import { ClickableRow } from '@/components/data/clickable-row'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { RowActions } from '@/components/data/row-actions'
import { SearchInput } from '@/components/data/search-input'
import { TableToolbar } from '@/components/data/table-toolbar'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { FilterChips } from '@/components/data/filter-chips'
import { EnteredByToggle } from '@/components/data/entered-by-toggle'
import { EnteredByCell, EnteredByHead } from '@/components/data/recorded-by'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { JOURNAL_SOURCE_LABELS } from '@/lib/accounting-labels'
import { formatTransactionDate, toCalendarDate, today } from '@/lib/date'
import { DATE_PRESETS, presetRange, readDatePreset } from '@/lib/list-filters'
import { formatMoney } from '@/lib/money'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as journalService from '@/server/services/journal.service'
import { trailsFor } from '@/server/services/audit.service'
import type { JournalSourceType } from '@prisma/client'

export const metadata: Metadata = { title: 'Journal entries' }

// The amount is the sum of a journal's lines, computed after the rows are read,
// so it is not a column the database can order by.
const SORTABLE = ['number', 'date', 'memo', 'source', 'status'] as const

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('journal:read')
  const search = await searchParams
  const query = parseListQuery(search)
  const sort = readSort(search, SORTABLE, { sort: 'date', dir: 'desc' })
  const datePreset = readDatePreset(search.date)
  const range = presetRange(datePreset, today(ctx.organization.timeZone))
  const sourceRaw = typeof search.source === 'string' ? search.source : undefined
  const source = sourceRaw && sourceRaw in JOURNAL_SOURCE_LABELS ? (sourceRaw as JournalSourceType) : undefined
  const { rows, total } = await journalService.list(ctx, query, {
    ...sort,
    sourceType: source,
    from: range?.from,
    to: range?.to,
  })
  const trails = await trailsFor(ctx, rows.map((journal) => journal.id))
  const linkParams = {
    q: query.q,
    sort: sort.sort,
    dir: sort.dir,
    date: datePreset || undefined,
    source,
  }
  const narrowed = Boolean(query.q || datePreset || source)

  const canPost = ctx.permissions.has('journal:post')
  const canDelete = ctx.features.allowJournalDelete && ctx.permissions.has('journal:reverse')
  const currency = ctx.organization.baseCurrency

  const newEntry = canPost ? (
    <Link href="/journals/new" className={buttonVariants({ size: 'sm' })}>
      <PlusIcon /> New entry
    </Link>
  ) : undefined

  return (
    <>
      <PageHeader
        title="Journal entries"
        description="Every posting in the ledger, whatever produced it, with the document and the party it came from. Entries are never edited — a correction is a reversal, and both stay on the record."
        actions={newEntry}
      />

      <div className="mb-3 flex flex-col gap-2">
        <FilterChips options={[...DATE_PRESETS]} active={datePreset} path="/journals" param="date" params={linkParams} />
        <FilterChips
          options={[
            { value: '', label: 'All types' },
            ...Object.entries(JOURNAL_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          active={source ?? ''}
          path="/journals"
          param="source"
          params={linkParams}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by number, description, customer or vendor" />
        <EnteredByToggle />
        <div className="ml-auto">
          <TableToolbar exportHref={`/api/exports/journals?${new URLSearchParams(
            Object.entries(linkParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
          ).toString()}`} />
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title={narrowed ? 'No entries match that filter' : 'Nothing posted yet'}
          description={
            narrowed
              ? 'Try another date, type, or search.'
              : 'Manual journals go here, alongside everything the system posts from invoices, bills and payments.'
          }
          action={!narrowed ? newEntry : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="number" label="Entry" state={sort} basePath="/journals" params={linkParams} className="w-28" />
                <SortableHeader column="date" label="Date" state={sort} basePath="/journals" params={linkParams} className="w-44" defaultDirection="desc" />
                <SortableHeader column="memo" label="Description" state={sort} basePath="/journals" params={linkParams} />
                <SortableHeader column="source" label="Source" state={sort} basePath="/journals" params={linkParams} />
                <TableHead className="w-36">Document</TableHead>
                <TableHead className="w-48">Customer / vendor</TableHead>
                <TableHead className="numeric w-32">Amount</TableHead>
                <SortableHeader column="status" label="Status" state={sort} basePath="/journals" params={linkParams} className="w-24" />
                <EnteredByHead />
                <TableHead className="w-10 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((journal) => (
                <ClickableRow
                  key={journal.id}
                  href={`/journals/${journal.id}`}
                  title={`Open journal ${journal.journalNumber}`}
                >
                  <TableCell>
                    <Link
                      href={`/journals/${journal.id}`}
                      className="tabular font-medium underline-offset-4 hover:underline"
                    >
                      {journal.journalNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {formatTransactionDate(toCalendarDate(journal.date), journal.postedAt, ctx.organization.timeZone)}
                  </TableCell>
                  <TableCell>
                    {journal.memo ?? <span className="text-muted-foreground">—</span>}
                    {journal.isAdjusting ? (
                      <Badge variant="outline" className="ml-2">
                        adjusting
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {JOURNAL_SOURCE_LABELS[journal.sourceType as JournalSourceType] ?? journal.sourceType}
                  </TableCell>
                  <TableCell className="tabular">
                    {journal.source.number ? (
                      journal.source.href ? (
                        <Link
                          href={journal.source.href}
                          className="underline-offset-4 hover:underline"
                        >
                          {journal.source.number}
                        </Link>
                      ) : (
                        journal.source.number
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="truncate">
                    {journal.source.partyName ? (
                      journal.source.partyHref ? (
                        <Link
                          href={journal.source.partyHref}
                          className="underline-offset-4 hover:underline"
                        >
                          {journal.source.partyName}
                        </Link>
                      ) : (
                        journal.source.partyName
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="numeric tabular">{formatMoney(journal.total, currency)}</TableCell>
                  <TableCell>
                    <Badge variant={journal.status === 'POSTED' ? 'success' : 'secondary'}>
                      {journal.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <EnteredByCell trail={trails.get(journal.id)} />
                  <TableCell className="print:hidden">
                    <RowActions
                      actions={[
                        { label: 'Open', href: `/journals/${journal.id}`, icon: 'open' },
                        ...(journal.source.href
                          ? [
                              {
                                label: 'Open source document',
                                href: journal.source.href,
                                icon: 'open' as const,
                              },
                            ]
                          : []),
                      ]}
                      onDelete={
                        canDelete
                          ? { kind: 'journal', id: journal.id, number: journal.journalNumber }
                          : undefined
                      }
                    />
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
          </ScrollSheet>
          <Pagination total={total} />
        </Card>
      )}
    </>
  )
}
