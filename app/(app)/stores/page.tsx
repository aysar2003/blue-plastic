import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as storeService from '@/server/services/store.service'

/**
 * Store opens on the office — the main door. Other stores are reached from
 * the office dashboard's network summary.
 */
export default async function StoresPage() {
  const ctx = await requireOrgContext('inventory:read')
  const office = await storeService.officeId(ctx)
  if (office) redirect(`/stores/${office}`)

  const stores = await storeService.list(ctx)
  if (stores[0]) redirect(`/stores/${stores[0].id}`)

  redirect('/inventory/stock')
}
