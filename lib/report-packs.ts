import { STANDARD_FAVOURITES, MANAGEMENT_REPORTS, PERFORMANCE_REPORTS } from '@/lib/standard-reports'

/** Slug after `/reports/` from a standard-report href. */
export function reportKeyFromHref(href: string): string | null {
  const match = /^\/reports\/([^/?#]+)/.exec(href.trim())
  return match?.[1] ?? null
}

/** Allowed pack members: standard-report slugs (table + statement pages). */
export function knownPackReportKeys(): string[] {
  const keys = new Set<string>()
  for (const row of [...STANDARD_FAVOURITES, ...MANAGEMENT_REPORTS, ...PERFORMANCE_REPORTS]) {
    const key = reportKeyFromHref(row.href)
    if (key) keys.add(key)
  }
  return [...keys].sort()
}

export function assertPackReportKeys(keys: string[]): string | null {
  if (keys.length === 0) return 'Choose at least one report.'
  if (keys.length > 20) return 'A pack can hold at most 20 reports.'
  const known = new Set(knownPackReportKeys())
  for (const key of keys) {
    if (!known.has(key)) return `"${key}" is not a standard report this pack can include.`
  }
  return null
}

/** Next run after a successful scheduled build. */
export function nextRunAfter(
  cadence: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
  from: Date = new Date(),
): Date | null {
  if (cadence === 'MANUAL') return null
  const next = new Date(from.getTime())
  if (cadence === 'DAILY') {
    next.setUTCDate(next.getUTCDate() + 1)
  } else if (cadence === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7)
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next
}

export function composePackCsv(
  sections: { title: string; key: string; csv: string }[],
): string {
  return sections
    .map((section) => `# ${section.title} (${section.key})\n${section.csv.trim()}\n`)
    .join('\n')
}
