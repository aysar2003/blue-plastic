import { PRODUCT_MARK } from '@/lib/product-brand'

/** Build a 1–3 letter mark from a company name when brandMark is empty. */
export function initialsFromName(name: string | null | undefined): string {
  const words = (name ?? '')
    .trim()
    .split(/[\s/_-]+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)

  if (words.length === 0) return PRODUCT_MARK
  if (words.length === 1) {
    const w = words[0]!
    return (w.length >= 2 ? w.slice(0, 2) : w).toUpperCase()
  }
  return words
    .slice(0, 3)
    .map((w) => w[0]!)
    .join('')
    .toUpperCase()
}

/** Prefer an explicit brand mark, else initials from the display name. */
export function resolveBrandMark(
  brandMark: string | null | undefined,
  name: string | null | undefined,
): string {
  const trimmed = brandMark?.trim()
  if (trimmed) return trimmed.slice(0, 4).toUpperCase()
  return initialsFromName(name)
}

export function orgLogoUrl(hasLogo: boolean, cacheKey?: string | number | Date | null): string | null {
  if (!hasLogo) return null
  // Always emit a stable numeric cache buster — Date props crossing the
  // server→client boundary can stringify as ISO on one side and getTime() on
  // the other, which mismatches the logo <img src> and breaks hydration.
  let v = '1'
  if (cacheKey instanceof Date) {
    v = String(cacheKey.getTime())
  } else if (typeof cacheKey === 'number' && Number.isFinite(cacheKey)) {
    v = String(cacheKey)
  } else if (cacheKey != null && cacheKey !== '') {
    const raw = String(cacheKey)
    const asNum = Number(raw)
    if (Number.isFinite(asNum) && /^\d+$/.test(raw)) {
      v = raw
    } else {
      const parsed = Date.parse(raw)
      v = Number.isNaN(parsed) ? raw : String(parsed)
    }
  }
  return `/api/organization/logo?v=${encodeURIComponent(v)}`
}
