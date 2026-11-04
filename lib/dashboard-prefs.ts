export type HomeKpiKey = 'profitMtd' | 'openAr' | 'reorder' | 'pipeline' | 'unpaidAp' | 'followUps'

export type DashboardPrefs = {
  kpiPins?: HomeKpiKey[]
}

const ALL_KPIS: HomeKpiKey[] = ['profitMtd', 'openAr', 'reorder', 'pipeline', 'unpaidAp', 'followUps']

export function parseDashboardPrefs(raw: unknown): DashboardPrefs {
  if (!raw || typeof raw !== 'object') return {}
  const data = raw as Record<string, unknown>
  if (!Array.isArray(data.kpiPins)) return {}
  const pins = data.kpiPins.filter(
    (key): key is HomeKpiKey => typeof key === 'string' && ALL_KPIS.includes(key as HomeKpiKey),
  )
  return { kpiPins: pins.length > 0 ? pins : undefined }
}

export function defaultKpiPins(): HomeKpiKey[] {
  return ['profitMtd', 'openAr', 'reorder', 'pipeline']
}

export function resolvedKpiPins(prefs: DashboardPrefs): HomeKpiKey[] {
  return prefs.kpiPins?.length ? prefs.kpiPins : defaultKpiPins()
}
