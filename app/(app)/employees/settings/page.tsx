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
        description="Work weekdays, OT bands (1.5x / 2x), and hours — used by payroll and leave."
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
