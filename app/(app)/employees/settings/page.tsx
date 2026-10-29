import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as hrSettingsService from '@/server/services/hr-settings.service'
import { HrSettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'HR settings' }

export default async function HrSettingsPage() {
  const ctx = await requireOrgContext('hr:read')
  const settings = await hrSettingsService.get(ctx)

  return (
    <>
      <PageHeader
        title="Settings"
        description="Hours/day, work week, and overtime — used by hourly payroll and leave hour conversion."
      />
      <HrSettingsForm settings={settings} canEdit={ctx.permissions.has('hr:update')} />
      <p className="mt-6 text-sm text-muted-foreground">
        Fingerprint / clock devices:{' '}
        <Link href="/employees/attendance/devices" className="text-primary hover:underline">
          Attendance → Devices
        </Link>
      </p>
    </>
  )
}
