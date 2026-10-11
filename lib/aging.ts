/** Age colours shared by the A/R and A/P ageing pictures. */
export const AGING_COLORS = {
  unapplied: '#64748B',
  current: '#0F766E',
  d1_30: '#0369A1',
  d31_60: '#B45309',
  d61_90: '#C2410C',
  d90_plus: '#BE123C',
} as const

export type AgingBucketId = keyof typeof AGING_COLORS

export const AGING_BUCKET_IDS = Object.keys(AGING_COLORS) as AgingBucketId[]

export function isAgingBucket(value: string | undefined): value is AgingBucketId {
  return Boolean(value && value in AGING_COLORS)
}

/** Read `bucket` from a report URL; unknown values are ignored. */
export function readAgingBucket(
  value: string | string[] | undefined,
): AgingBucketId | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return isAgingBucket(raw) ? raw : undefined
}

/**
 * Keep every report control already on the page, and set or clear the age filter.
 * Same idea as the chart-of-accounts type chips.
 */
export function agingFilterHref(
  path: string,
  params: Record<string, string | string[] | undefined>,
  bucket?: string,
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === 'bucket') continue
    const one = Array.isArray(value) ? value[0] : value
    if (one) search.set(key, one)
  }
  if (bucket) search.set('bucket', bucket)
  const query = search.toString()
  return query ? `${path}?${query}` : path
}
