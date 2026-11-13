export const POS_OFFLINE_DB = 'som-pos-offline'
export const POS_OFFLINE_DB_VERSION = 1
export const POS_SNAPSHOT_STORE = 'snapshots'
export const POS_PENDING_STORE = 'pendingSales'

export function snapshotKey(orgId: string, registerId: string): string {
  return `${orgId}:${registerId}`
}

export function openPosOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    const request = indexedDB.open(POS_OFFLINE_DB, POS_OFFLINE_DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(POS_SNAPSHOT_STORE)) {
        db.createObjectStore(POS_SNAPSHOT_STORE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(POS_PENDING_STORE)) {
        const store = db.createObjectStore(POS_PENDING_STORE, { keyPath: 'clientSaleId' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('registerId', 'registerId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function idbTransactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}
