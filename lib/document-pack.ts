/** Combined print / PDF of several sales or purchase papers, like the project quotation pack. */

export const DOCUMENT_PACK_LIMIT = 50

const SKIP_STATUSES = new Set(['VOID', 'DECLINED'])

export function parsePackIds(raw: string | null | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= DOCUMENT_PACK_LIMIT) break
  }
  return ids
}

export function isPackableStatus(status: string) {
  return !SKIP_STATUSES.has(status)
}

export function sortPackDocuments<T extends { date: Date | string; number: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const left = typeof a.date === 'string' ? a.date : a.date.toISOString().slice(0, 10)
    const right = typeof b.date === 'string' ? b.date : b.date.toISOString().slice(0, 10)
    return left.localeCompare(right) || a.number.localeCompare(b.number)
  })
}

export function documentPackSearch(input: {
  ids?: string[]
  customer?: string
  vendorId?: string
  status?: string
  date?: string
}): string {
  const params = new URLSearchParams()
  if (input.ids?.length) params.set('ids', input.ids.slice(0, DOCUMENT_PACK_LIMIT).join(','))
  else {
    if (input.customer) params.set('customer', input.customer)
    if (input.vendorId) params.set('vendorId', input.vendorId)
    if (input.status) params.set('status', input.status)
    if (input.date && input.date !== 'all') params.set('date', input.date)
  }
  return params.toString()
}

export function salesPackPrintHref(slug: string, query: string) {
  return query ? `/sales/${slug}/pack/print?${query}` : `/sales/${slug}/pack/print`
}

export function salesPackPdfHref(slug: string, query: string) {
  return query ? `/api/sales/pack/${slug}/pdf?${query}` : `/api/sales/pack/${slug}/pdf`
}

export function purchasesPackPrintHref(slug: string, query: string) {
  return query ? `/purchases/${slug}/pack/print?${query}` : `/purchases/${slug}/pack/print`
}

export function purchasesPackPdfHref(slug: string, query: string) {
  return query ? `/api/purchases/pack/${slug}/pdf?${query}` : `/api/purchases/pack/${slug}/pdf`
}

export function listExportHref(
  slug: string,
  params: Record<string, string | undefined>,
  ids?: readonly string[],
) {
  const search = new URLSearchParams()
  if (ids?.length) {
    search.set('ids', ids.slice(0, DOCUMENT_PACK_LIMIT).join(','))
  } else {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value)
    }
  }
  const query = search.toString()
  return query ? `/api/exports/${slug}?${query}` : `/api/exports/${slug}`
}

export function singleDocumentPdfHref(area: 'sales' | 'purchases', id: string) {
  return area === 'sales' ? `/api/sales/${id}/pdf` : `/api/purchases/${id}/pdf`
}
