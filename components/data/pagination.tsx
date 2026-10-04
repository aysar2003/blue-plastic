/**
 * How many rows the sheet is showing. Lists load the whole result and scroll;
 * there is no Next page.
 */
export function Pagination({
  total,
}: {
  page?: number
  pageCount?: number
  total: number
  pageSize?: number
  basePath?: string
  params?: Record<string, string | undefined>
}) {
  if (total === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-3 py-1.5 text-xs">
      <p className="text-muted-foreground">
        <span className="tabular">{total}</span> {total === 1 ? 'row' : 'rows'}
      </p>
    </div>
  )
}
