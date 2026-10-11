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
  const v =
    cacheKey instanceof Date
      ? cacheKey.getTime()
      : cacheKey != null && cacheKey !== ''
        ? String(cacheKey)
        : '1'
  return `/api/organization/logo?v=${encodeURIComponent(v)}`
}
