import 'server-only'

import type { Tx } from '@/server/db'

/**
 * Allow ledger integrity triggers to let an organisation CASCADE-delete through
 * posted journals, system accounts, and stock movements. Local to the current
 * transaction only (`set_config` third arg = true).
 */
export async function allowCompanyWipe(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.allow_company_wipe', 'on', true)`
}
