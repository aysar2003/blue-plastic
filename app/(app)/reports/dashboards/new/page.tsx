import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  DASHBOARD_KPI_KEYS,
  DASHBOARD_REPORT_KEYS,
  DASHBOARD_SPARK_KEYS,
  tileTitle,
} from '@/lib/erp/dashboard-board'
import { requireOrgContext } from '@/server/auth/context'

import { createDashboard } from '../actions'

export const metadata: Metadata = { title: 'New dashboard' }

export default async function NewDashboardPage() {
  await requireOrgContext('report:export')

  return (
    <>
      <PageHeader
        title="New dashboard"
        description="Pick tiles from home KPIs, standard reports, or spark metrics. Leave tiles blank to start with a default set."
      />
      <form action={createDashboard} className="mx-auto max-w-xl space-y-4">
        <Input name="name" placeholder="Board name" required />
        <Input name="description" placeholder="Description (optional)" />

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Tile 1</p>
          <NativeSelect name="tileKind" defaultValue="KPI">
            <option value="KPI">KPI</option>
            <option value="REPORT">Report</option>
            <option value="SPARK">Spark</option>
          </NativeSelect>
          <NativeSelect name="tileRef" defaultValue={DASHBOARD_KPI_KEYS[0]}>
            {DASHBOARD_KPI_KEYS.map((key) => (
              <option key={key} value={key}>
                {tileTitle('KPI', key)}
              </option>
            ))}
            {DASHBOARD_REPORT_KEYS.map((key) => (
              <option key={key} value={key}>
                Report · {tileTitle('REPORT', key)}
              </option>
            ))}
            {DASHBOARD_SPARK_KEYS.map((key) => (
              <option key={key} value={key}>
                Spark · {tileTitle('SPARK', key)}
              </option>
            ))}
          </NativeSelect>
          <Input name="tileThreshold" placeholder="Watch threshold (optional)" />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Tile 2</p>
          <NativeSelect name="tileKind" defaultValue="REPORT">
            <option value="KPI">KPI</option>
            <option value="REPORT">Report</option>
            <option value="SPARK">Spark</option>
          </NativeSelect>
          <NativeSelect name="tileRef" defaultValue={DASHBOARD_REPORT_KEYS[0]}>
            {DASHBOARD_KPI_KEYS.map((key) => (
              <option key={key} value={key}>
                {tileTitle('KPI', key)}
              </option>
            ))}
            {DASHBOARD_REPORT_KEYS.map((key) => (
              <option key={key} value={key}>
                Report · {tileTitle('REPORT', key)}
              </option>
            ))}
            {DASHBOARD_SPARK_KEYS.map((key) => (
              <option key={key} value={key}>
                Spark · {tileTitle('SPARK', key)}
              </option>
            ))}
          </NativeSelect>
          <Input name="tileThreshold" placeholder="Watch threshold (optional)" />
        </div>

        <Button type="submit">Create dashboard</Button>
      </form>
    </>
  )
}
