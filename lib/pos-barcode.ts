/**
 * Selling by barcode at the till.
 *
 * A USB or Bluetooth scanner types the code very fast and then presses Enter.
 * A person typing a price or a note is slower, so those keys are left alone.
 */

export type BarcodeProduct = {
  id: string
  sku: string | null
  barcode?: string | null
}

export const SCAN_GAP_MS = 50
export const SCAN_MIN_LENGTH = 4

export type ScanBuffer = {
  chars: string
  lastAt: number
  /** Keys that were allowed into whatever field was focused. */
  leaked: number
}

export const EMPTY_SCAN: ScanBuffer = { chars: '', lastAt: 0, leaked: 0 }

export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/\s+/g, '')
}

/** Exact barcode first, then exact SKU. */
export function matchPosBarcode<T extends BarcodeProduct>(products: readonly T[], raw: string): T | null {
  const code = normalizeBarcode(raw).toLowerCase()
  if (!code) return null
  const byBarcode = products.find((product) => sameCode(product.barcode, code))
  if (byBarcode) return byBarcode
  return products.find((product) => sameCode(product.sku, code)) ?? null
}

function sameCode(value: string | null | undefined, code: string) {
  if (!value) return false
  return normalizeBarcode(value).toLowerCase() === code
}

/**
 * One key from the till. A finished scan returns the code, asks to swallow
 * Enter, and says how many characters already landed in the focused field.
 */
export function noteScanKey(
  state: ScanBuffer,
  key: string,
  now: number,
  modified: boolean,
): { state: ScanBuffer; code: string | null; swallow: boolean; peel: number } {
  const idle = { code: null as string | null, swallow: false, peel: 0 }
  const gap = state.lastAt === 0 ? Number.POSITIVE_INFINITY : now - state.lastAt

  if (modified || (key.length !== 1 && key !== 'Enter')) {
    if (gap > SCAN_GAP_MS) return { state: { chars: '', lastAt: now, leaked: 0 }, ...idle }
    return { state, ...idle }
  }

  if (key === 'Enter') {
    const rapid = state.chars.length - state.leaked
    const done = state.chars.length >= SCAN_MIN_LENGTH && rapid >= SCAN_MIN_LENGTH - 1
    return {
      state: EMPTY_SCAN,
      code: done ? state.chars : null,
      swallow: done,
      peel: done ? state.leaked : 0,
    }
  }

  if (gap > SCAN_GAP_MS) {
    return { state: { chars: key, lastAt: now, leaked: 1 }, ...idle }
  }

  return {
    state: { chars: state.chars + key, lastAt: now, leaked: state.leaked },
    code: null,
    swallow: true,
    peel: 0,
  }
}
