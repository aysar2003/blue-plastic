import type { Metadata } from 'next'

import { PosSettingsPanel } from '@/components/pos/pos-settings-panel'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'POS settings' }

export default async function PosSettingsPage() {
  const ctx = await requireOrgContext('pos:manage')
  const data = await posService.settingsOverview(ctx)
  return <PosSettingsPanel data={data} />
}
