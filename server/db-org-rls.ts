import 'server-only'

import { db, type Tx } from '@/server/db'

/**
 * Pin Postgres GUC `app.current_org_id` for the remainder of an interactive
 * transaction so optional `erp_app_org` RLS policies can filter rows.
 * No-op for the default postgres bypassrls role.
 */
export async function setTxOrgId(tx: Tx, orgId: string): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`
}

export async function setTxRlsBypass(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.rls_bypass', '1', true)`
}

/** Run work inside a transaction with org RLS context set. */
export async function withOrgTx<T>(
  orgId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await setTxOrgId(tx, orgId)
    return fn(tx)
  })
}
