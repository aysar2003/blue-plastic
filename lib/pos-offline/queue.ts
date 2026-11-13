import {
  idbRequest,
  idbTransactionDone,
  openPosOfflineDb,
  POS_PENDING_STORE,
} from './db'
import type { PosOfflineCheckoutPayload, PosOfflinePendingSale } from './types'

export function newClientSaleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `offline-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function enqueuePendingSale(
  payload: PosOfflineCheckoutPayload & { totalLabel: string },
): Promise<PosOfflinePendingSale> {
  const row: PosOfflinePendingSale = {
    ...payload,
    createdAt: new Date().toISOString(),
    localStatus: 'pending',
    lastError: null,
  }
  const db = await openPosOfflineDb()
  try {
    const tx = db.transaction(POS_PENDING_STORE, 'readwrite')
    tx.objectStore(POS_PENDING_STORE).put(row)
    await idbTransactionDone(tx)
  } finally {
    db.close()
  }
  return row
}

export async function listPendingSales(registerId?: string): Promise<PosOfflinePendingSale[]> {
  try {
    const db = await openPosOfflineDb()
    try {
      const tx = db.transaction(POS_PENDING_STORE, 'readonly')
      const store = tx.objectStore(POS_PENDING_STORE)
      const rows = (await idbRequest(store.getAll())) as PosOfflinePendingSale[]
      const filtered = registerId ? rows.filter((row) => row.registerId === registerId) : rows
      return filtered
        .filter(
          (row) =>
            row.localStatus === 'pending' ||
            row.localStatus === 'failed' ||
            row.localStatus === 'syncing',
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    } finally {
      db.close()
    }
  } catch {
    return []
  }
}

export async function countPendingSales(registerId?: string): Promise<number> {
  const rows = await listPendingSales(registerId)
  return rows.length
}

export async function markPendingSyncing(clientSaleId: string): Promise<void> {
  await patchPending(clientSaleId, { localStatus: 'syncing', lastError: null })
}

export async function markPendingFailed(clientSaleId: string, message: string): Promise<void> {
  await patchPending(clientSaleId, { localStatus: 'failed', lastError: message })
}

export async function removePendingSale(clientSaleId: string): Promise<void> {
  const db = await openPosOfflineDb()
  try {
    const tx = db.transaction(POS_PENDING_STORE, 'readwrite')
    tx.objectStore(POS_PENDING_STORE).delete(clientSaleId)
    await idbTransactionDone(tx)
  } finally {
    db.close()
  }
}

async function patchPending(
  clientSaleId: string,
  patch: Partial<Pick<PosOfflinePendingSale, 'localStatus' | 'lastError'>>,
): Promise<void> {
  const db = await openPosOfflineDb()
  try {
    const tx = db.transaction(POS_PENDING_STORE, 'readwrite')
    const store = tx.objectStore(POS_PENDING_STORE)
    const existing = (await idbRequest(store.get(clientSaleId))) as PosOfflinePendingSale | undefined
    if (!existing) {
      await idbTransactionDone(tx)
      return
    }
    store.put({ ...existing, ...patch })
    await idbTransactionDone(tx)
  } finally {
    db.close()
  }
}

/** Pure FIFO order helper for tests (no IndexedDB). */
export function sortPendingFifo(rows: PosOfflinePendingSale[]): PosOfflinePendingSale[] {
  return [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
