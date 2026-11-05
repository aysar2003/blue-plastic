'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  DASHBOARD_KPI_KEYS,
  DASHBOARD_REPORT_KEYS,
  DASHBOARD_SPARK_KEYS,
  isDashboardTileKind,
  type DashboardTileKind,
} from '@/lib/erp/dashboard-board'
import { requireOrgContext } from '@/server/auth/context'
import * as dashboardBoard from '@/server/services/dashboard-board.service'

const PATH = '/reports/dashboards'

export async function createDashboard(formData: FormData) {
  const ctx = await requireOrgContext('report:export')
  const name = String(formData.get('name') ?? '')
  const description = String(formData.get('description') ?? '') || null
  const kinds = formData.getAll('tileKind').map(String)
  const refs = formData.getAll('tileRef').map(String)
  const thresholds = formData.getAll('tileThreshold').map(String)
  const tiles: { kind: DashboardTileKind; refKey: string; threshold?: string | null }[] = []
  for (let i = 0; i < kinds.length; i++) {
    const kindRaw = kinds[i] ?? ''
    const refKey = (refs[i] ?? '').trim()
    if (!isDashboardTileKind(kindRaw) || !refKey) continue
    tiles.push({
      kind: kindRaw,
      refKey,
      threshold: (thresholds[i] ?? '').trim() || null,
    })
  }
  if (tiles.length === 0) {
    // Sensible default board when the form only names the dashboard.
    tiles.push(
      { kind: 'KPI', refKey: DASHBOARD_KPI_KEYS[0] },
      { kind: 'KPI', refKey: DASHBOARD_KPI_KEYS[1] },
      { kind: 'REPORT', refKey: DASHBOARD_REPORT_KEYS[0] },
      { kind: 'SPARK', refKey: DASHBOARD_SPARK_KEYS[0] },
    )
  }
  const board = await dashboardBoard.create(ctx, { name, description, tiles })
  revalidatePath(PATH)
  redirect(`${PATH}/${board.id}`)
}

export async function deleteDashboard(formData: FormData) {
  const ctx = await requireOrgContext('report:export')
  await dashboardBoard.remove(ctx, String(formData.get('id') ?? ''))
  revalidatePath(PATH)
  redirect(PATH)
}
