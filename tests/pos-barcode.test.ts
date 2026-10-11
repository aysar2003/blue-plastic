import { describe, expect, it } from 'vitest'

import {
  EMPTY_SCAN,
  matchPosBarcode,
  noteScanKey,
  SCAN_GAP_MS,
  type ScanBuffer,
} from '@/lib/pos-barcode'

const products = [
  { id: 'a4', sku: 'A4', barcode: null },
  { id: 'pipe', sku: 'PVC-4', barcode: '1234567890123' },
  { id: 'tape', sku: null, barcode: '000111' },
]

function scan(keys: string[], gap: number) {
  let state: ScanBuffer = EMPTY_SCAN
  let now = 1_000
  const seen: { key: string; swallow: boolean; code: string | null; peel: number }[] = []
  for (const key of keys) {
    now += gap
    const result = noteScanKey(state, key, now, false)
    state = result.state
    seen.push({ key, swallow: result.swallow, code: result.code, peel: result.peel })
  }
  return seen
}

describe('POS barcode', () => {
  it('sells the item whose barcode or SKU was scanned', () => {
    expect(matchPosBarcode(products, '1234567890123')?.id).toBe('pipe')
    expect(matchPosBarcode(products, ' 1234 5678 90123 ')?.id).toBe('pipe')
    expect(matchPosBarcode(products, 'pvc-4')?.id).toBe('pipe')
    expect(matchPosBarcode(products, '000111')?.id).toBe('tape')
    expect(matchPosBarcode(products, 'A4')?.id).toBe('a4')
    expect(matchPosBarcode(products, 'nope')).toBeNull()
  })

  it('treats a fast burst ending in Enter as a scan, and slow typing as a person', () => {
    const scanned = scan(['1', '2', '3', '4', '5', '6', '7', '8', 'Enter'], 10)
    expect(scanned.slice(0, -1).map((key) => key.swallow)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ])
    expect(scanned.at(-1)).toMatchObject({ swallow: true, code: '12345678', peel: 1 })

    const typed = scan(['1', '2', '3', '4', '5', 'Enter'], SCAN_GAP_MS + 30)
    expect(typed.every((key) => key.code === null && key.swallow === false)).toBe(true)
  })

  it('leaves a short code and a modified key for the field that has focus', () => {
    const short = scan(['1', '2', '3', 'Enter'], 10)
    expect(short.at(-1)?.code).toBeNull()

    const held = noteScanKey(EMPTY_SCAN, 'a', 10, true)
    expect(held.swallow).toBe(false)
    expect(held.code).toBeNull()
  })
})
