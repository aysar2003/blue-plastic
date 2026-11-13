import {
  idbRequest,
  idbTransactionDone,
  openPosOfflineDb,
  POS_SNAPSHOT_STORE,
  snapshotKey,
} from './db'
import type { PosOfflineSnapshot } from './types'

export { snapshotKey }

export async function savePosSnapshot(
  snapshot: Omit<PosOfflineSnapshot, 'key' | 'savedAt'> & { key?: string; savedAt?: string },
): Promise<PosOfflineSnapshot> {
  const row: PosOfflineSnapshot = {
    ...snapshot,
    key: snapshot.key ?? snapshotKey(snapshot.orgId, snapshot.registerId),
    savedAt: snapshot.savedAt ?? new Date().toISOString(),
  }
  try {
    const db = await openPosOfflineDb()
    try {
      const tx = db.transaction(POS_SNAPSHOT_STORE, 'readwrite')
      tx.objectStore(POS_SNAPSHOT_STORE).put(row)
      await idbTransactionDone(tx)
    } finally {
      db.close()
    }
  } catch {
    // Private mode / tests without IndexedDB — online till still works.
  }
  return row
}

export async function loadPosSnapshot(
  orgId: string,
  registerId: string,
): Promise<PosOfflineSnapshot | null> {
  try {
    const db = await openPosOfflineDb()
    try {
      const tx = db.transaction(POS_SNAPSHOT_STORE, 'readonly')
      const row = await idbRequest(
        tx.objectStore(POS_SNAPSHOT_STORE).get(snapshotKey(orgId, registerId)),
      )
      return (row as PosOfflineSnapshot | undefined) ?? null
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}
