/**
 * Bill-to / meta lines on the merchant print paper (left column).
 * Customize prefs hide or reorder them the same way table columns do.
 */

export const PAPER_META_STORAGE_KEY = 'merchant-paper-meta-v1'

export type PaperMetaFieldId =
  | 'reference'
  | 'dueDate'
  | 'payment'
  | 'address'
  | 'phone'
  | 'order'
  | 'person'
  | 'workSite'
  | 'workScope'
  | 'email'

export type PaperMetaField = { id: PaperMetaFieldId; label: string }

/** Default order on the customer paper. */
export const PAPER_META_FIELDS: PaperMetaField[] = [
  { id: 'reference', label: 'Cust P.O no' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'payment', label: 'Payment' },
  { id: 'address', label: 'Address' },
  { id: 'phone', label: 'Phone' },
  { id: 'order', label: 'Sales order' },
  { id: 'person', label: 'Sales person' },
  { id: 'workSite', label: 'Work site' },
  { id: 'workScope', label: 'Work / job' },
  { id: 'email', label: 'Email' },
]

export const PAPER_META_IDS = PAPER_META_FIELDS.map((field) => field.id)

/** Append `meta=` (comma-separated hidden ids) for PDF download. */
export function withPaperMetaHidden(href: string, hidden: string[]): string {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    if (hidden.length === 0) url.searchParams.delete('meta')
    else url.searchParams.set('meta', hidden.join(','))
    if (href.startsWith('http://') || href.startsWith('https://')) return url.toString()
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    if (hidden.length === 0) return href
    const join = href.includes('?') ? '&' : '?'
    return `${href}${join}meta=${encodeURIComponent(hidden.join(','))}`
  }
}

export function parsePaperMetaHidden(raw: string | null | undefined): PaperMetaFieldId[] {
  if (!raw?.trim()) return []
  const valid = new Set<string>(PAPER_META_IDS)
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((id): id is PaperMetaFieldId => valid.has(id))
}

/** Hidden ids from the Paper details customize dialog (localStorage). */
export function readStoredPaperMetaHidden(): PaperMetaFieldId[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PAPER_META_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { hidden?: unknown }
    if (!Array.isArray(parsed.hidden)) return []
    const valid = new Set<string>(PAPER_META_IDS)
    return parsed.hidden.filter((id): id is PaperMetaFieldId => typeof id === 'string' && valid.has(id))
  } catch {
    return []
  }
}
