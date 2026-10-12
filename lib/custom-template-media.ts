/**
 * PDF / image files attached to My templates.
 * Blobs live in IndexedDB (localStorage is too small); metadata stays on the template row.
 */

export const CUSTOM_TEMPLATE_MEDIA_DB = 'bpc-custom-template-media'
export const CUSTOM_TEMPLATE_MEDIA_STORE = 'files'

export const MAX_TEMPLATE_MEDIA_BYTES = 8 * 1024 * 1024

export type TemplateMediaKind = 'pdf' | 'image'

export type TemplateMediaMeta = {
  kind: TemplateMediaKind
  contentType: string
  fileName: string
  sizeBytes: number
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function sniffTemplateMedia(
  file: File,
): { ok: true; meta: TemplateMediaMeta } | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: 'That file is empty.' }
  if (file.size > MAX_TEMPLATE_MEDIA_BYTES) {
    return { ok: false, error: 'Use a PDF or image of 8 MB or smaller.' }
  }

  const name = file.name.trim().slice(0, 120) || 'template'
  const type = file.type

  if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    return {
      ok: true,
      meta: {
        kind: 'pdf',
        contentType: 'application/pdf',
        fileName: name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`,
        sizeBytes: file.size,
      },
    }
  }

  if (IMAGE_TYPES.has(type) || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
    const contentType = IMAGE_TYPES.has(type)
      ? type
      : name.toLowerCase().endsWith('.png')
        ? 'image/png'
        : name.toLowerCase().endsWith('.webp')
          ? 'image/webp'
          : name.toLowerCase().endsWith('.gif')
            ? 'image/gif'
            : 'image/jpeg'
    return {
      ok: true,
      meta: {
        kind: 'image',
        contentType,
        fileName: name,
        sizeBytes: file.size,
      },
    }
  }

  return { ok: false, error: 'Use a PDF, JPEG, PNG, WebP, or GIF.' }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CUSTOM_TEMPLATE_MEDIA_DB, 1)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CUSTOM_TEMPLATE_MEDIA_STORE)) {
        db.createObjectStore(CUSTOM_TEMPLATE_MEDIA_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export async function putTemplateMedia(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CUSTOM_TEMPLATE_MEDIA_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    tx.objectStore(CUSTOM_TEMPLATE_MEDIA_STORE).put(blob, id)
  })
  db.close()
}

export async function getTemplateMedia(id: string): Promise<Blob | null> {
  const db = await openDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(CUSTOM_TEMPLATE_MEDIA_STORE, 'readonly')
    const request = tx.objectStore(CUSTOM_TEMPLATE_MEDIA_STORE).get(id)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null)
  })
  db.close()
  return blob
}

export async function deleteTemplateMedia(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CUSTOM_TEMPLATE_MEDIA_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
    tx.objectStore(CUSTOM_TEMPLATE_MEDIA_STORE).delete(id)
  })
  db.close()
}

/** Sample an image for a usable accent colour (invoice band). */
export async function accentFromImageBlob(blob: Blob): Promise<string | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
  try {
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    const size = 32
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, size, size)
    bitmap.close()
    const { data } = ctx.getImageData(0, 0, size, size)
    let best = { score: -1, r: 30, g: 184, b: 174 }
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      const a = data[i + 3] ?? 0
      if (a < 200) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      const lum = (r + g + b) / 3
      if (lum < 40 || lum > 230) continue
      const score = sat * 2 + (lum > 80 && lum < 180 ? 0.5 : 0)
      if (score > best.score) best = { score, r, g, b }
    }
    if (best.score < 0) return null
    const hex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`
  } catch {
    return null
  }
}

export function formatMediaSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** Logo-only upload: JPEG / PNG / WebP / GIF up to 2 MB. */
export function sniffLogoImage(
  file: File,
): { ok: true; meta: TemplateMediaMeta } | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: 'That logo file is empty.' }
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: 'Use a logo image of 2 MB or smaller.' }
  const sniffed = sniffTemplateMedia(file)
  if (!sniffed.ok) return sniffed
  if (sniffed.meta.kind !== 'image') return { ok: false, error: 'Use a JPEG, PNG, WebP, or GIF logo.' }
  return sniffed
}
