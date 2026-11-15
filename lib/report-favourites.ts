/**
 * Browser favourites for the report centre. Empty by default so people only
 * keep the reports they star.
 */

export const REPORT_FAVOURITES_STORAGE = 'bpc.reportFavourites'
export const REPORT_FAVOURITES_CHANGE = 'bpc-report-favourites'

export type ReportFavourite = {
  href: string
  label: string
}

export function reportFavouriteKey(report: ReportFavourite) {
  return report.href + report.label
}

export function parseReportFavourites(raw: string | null): ReportFavourite[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (item && typeof item === 'object' && 'href' in item && 'label' in item) {
        const href = (item as { href: unknown }).href
        const label = (item as { label: unknown }).label
        if (typeof href === 'string' && typeof label === 'string') return [{ href, label }]
        return []
      }
      // Older builds stored href+label strings; those cannot be listed alone.
      return []
    })
  } catch {
    return []
  }
}

export function toggleReportFavourite(
  current: ReportFavourite[],
  report: ReportFavourite,
): ReportFavourite[] {
  const key = reportFavouriteKey(report)
  return current.some((item) => reportFavouriteKey(item) === key)
    ? current.filter((item) => reportFavouriteKey(item) !== key)
    : [...current, { href: report.href, label: report.label }]
}
