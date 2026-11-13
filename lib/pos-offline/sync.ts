import type { PosCheckoutInput } from '@/lib/validation/pos'

import {
  listPendingSales,
  markPendingFailed,
  markPendingSyncing,
  removePendingSale,
} from './queue'
import { probePosOnline } from './network'
import type { PosOfflinePendingSale } from './types'

export type PosCheckoutFn = (
  input: PosCheckoutInput,
) => Promise<{ ok: true; data: { id: string; number: string; total: string } } | { ok: false; error: { message: string } }>

export type SyncPendingResult = {
  synced: number
  failed: number
  remaining: number
  errors: string[]
}

function toCheckoutInput(row: PosOfflinePendingSale): PosCheckoutInput {
  return {
    registerId: row.registerId,
    sessionId: row.sessionId,
    customerId: row.customerId,
    note: row.note ?? null,
    lines: row.lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      unitPrice: line.unitPrice ?? undefined,
      storeId: line.storeId,
      lotNumber: line.lotNumber ?? undefined,
      serialNumber: line.serialNumber ?? undefined,
    })),
    payments: row.payments,
    changeMethodId: row.changeMethodId,
    estimateId: row.estimateId,
    tipAmount: row.tipAmount ?? '0',
    diningTableId: row.diningTableId,
    prescriptionRef: row.prescriptionRef ?? null,
    clientSaleId: row.clientSaleId,
  } satisfies PosCheckoutInput
}

/** Drain pending sales FIFO through posCheckout. Stops after consecutive hard failures stay queued. */
export async function syncPendingPosSales(
  checkout: PosCheckoutFn,
  options: { registerId?: string; ensureOnline?: boolean } = {},
): Promise<SyncPendingResult> {
  if (options.ensureOnline !== false) {
    const online = await probePosOnline()
    if (!online) {
      const remaining = (await listPendingSales(options.registerId)).length
      return { synced: 0, failed: 0, remaining, errors: ['Still offline — sales stay queued.'] }
    }
  }

  const pending = await listPendingSales(options.registerId)
  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const row of pending) {
    await markPendingSyncing(row.clientSaleId)
    try {
      const result = await checkout(toCheckoutInput(row))
      if (!result.ok) {
        failed += 1
        const message = result.error.message || 'Sync failed'
        errors.push(`${row.clientSaleId}: ${message}`)
        await markPendingFailed(row.clientSaleId, message)
        continue
      }
      await removePendingSale(row.clientSaleId)
      synced += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : 'Sync failed'
      errors.push(`${row.clientSaleId}: ${message}`)
      await markPendingFailed(row.clientSaleId, message)
    }
  }

  const remaining = (await listPendingSales(options.registerId)).length
  return { synced, failed, remaining, errors }
}
