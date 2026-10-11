import { FilterChips } from '@/components/data/filter-chips'
import { InteractiveGrid, type InteractiveColumn, type InteractiveRow } from '@/components/data/interactive-grid'
import { ShareBar } from '@/components/reports/figure-chart'
import { agingFilterHref, type AgingBucketId } from '@/lib/aging'
import { money } from '@/lib/money'

export type AgingSlice = {
  id: AgingBucketId
  label: string
  /** Decimal string. Zero slices are left off the bar. */
  amount: string
  color: string
  /** How many counterparties still hold money in this age. */
  count: number
}

/**
 * The ageing picture, the prepared age filter, and the table under them.
 * Choosing an age rewrites `bucket` in the URL — same pattern as the chart of
 * accounts type chips — so the back button and a shared link keep the same view.
 */
export function AgingExplorer({
  caption,
  currency,
  storageKey,
  path,
  params,
  activeBucket,
  rowNoun,
  segments,
  columns,
  rows,
}: {
  caption: string
  currency: string
  storageKey: string
  path: string
  params: Record<string, string | string[] | undefined>
  activeBucket?: AgingBucketId
  /** "customer" or "vendor" — written into the filter summary. */
  rowNoun: string
  segments: AgingSlice[]
  columns: InteractiveColumn[]
  rows: InteractiveRow[]
}) {
  const shownRows = activeBucket
    ? rows.filter((row) => {
        const value = row.cells[activeBucket]?.value
        return value != null && value !== '' && !/^0(\.0+)?$/.test(value)
      })
    : rows

  const activeSegment = segments.find((segment) => segment.id === activeBucket)

  const chipOptions = [
    { value: '', label: `All · ${rows.length}` },
    ...segments.map((segment) => ({
      value: segment.id,
      label: `${segment.label} · ${segment.count}`,
    })),
  ]

  return (
    <>
      <div className="mb-3">
        <ShareBar
          caption={caption}
          currency={currency}
          activeId={activeBucket ?? null}
          segments={segments.map((segment) => ({
            id: segment.id,
            label: segment.label,
            value: money(segment.amount),
            color: segment.color,
            href: agingFilterHref(
              path,
              params,
              activeBucket === segment.id ? undefined : segment.id,
            ),
          }))}
        />
      </div>

      <div className="mb-3 print:hidden">
        <FilterChips
          path={path}
          param="bucket"
          active={activeBucket ?? ''}
          params={Object.fromEntries(
            Object.entries(params)
              .filter(([key]) => key !== 'bucket')
              .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
          )}
          options={chipOptions}
        />
      </div>

      <div className="scroll-mt-4">
        {activeSegment ? (
          <p className="mb-2 text-sm text-slate-800">
            <span className="font-semibold">{activeSegment.label}</span>
            <span className="text-slate-600">
              {' '}
              — {shownRows.length}{' '}
              {shownRows.length === 1 ? rowNoun : `${rowNoun}s`} in the report below
            </span>
          </p>
        ) : null}

        {shownRows.length === 0 ? (
          <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
            Nothing outstanding.
          </div>
        ) : (
          <InteractiveGrid
            key={activeBucket ?? 'all'}
            storageKey={storageKey}
            currency={currency}
            customizable
            initialSort={activeBucket ? { id: activeBucket, dir: 'desc' } : { id: 'total', dir: 'desc' }}
            columns={columns}
            rows={shownRows}
          />
        )}
      </div>
    </>
  )
}
