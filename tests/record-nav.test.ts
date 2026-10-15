import { describe, expect, it } from 'vitest'

import { neighborHrefs } from '@/components/forms/record-nav'

/** Mirrors sales/purchase/journal neighbors placement: new form sits after the last. */
function placeNeighbors(
  rows: { id: string; number: string }[],
  currentId: string | null,
) {
  const index = currentId == null ? rows.length : rows.findIndex((row) => row.id === currentId)
  const place = index < 0 ? rows.length : index
  return {
    previous: place > 0 ? rows[place - 1]! : null,
    next: place < rows.length - 1 ? rows[place + 1]! : null,
  }
}

const rows = [
  { id: 'a', number: 'INV-001' },
  { id: 'b', number: 'INV-002' },
  { id: 'c', number: 'INV-003' },
]

describe('neighbors placement', () => {
  it('puts a blank new form after the last saved record', () => {
    expect(placeNeighbors(rows, null)).toEqual({
      previous: rows[2],
      next: null,
    })
  })

  it('returns both sides for a middle record', () => {
    expect(placeNeighbors(rows, 'b')).toEqual({
      previous: rows[0],
      next: rows[2],
    })
  })

  it('disables Back on the oldest record', () => {
    expect(placeNeighbors(rows, 'a')).toEqual({
      previous: null,
      next: rows[1],
    })
  })

  it('disables Forward next on the newest saved record', () => {
    expect(placeNeighbors(rows, 'c')).toEqual({
      previous: rows[1],
      next: null,
    })
  })

  it('treats an unknown id like a new form', () => {
    expect(placeNeighbors(rows, 'missing')).toEqual({
      previous: rows[2],
      next: null,
    })
  })
})

describe('neighborHrefs', () => {
  it('Back from a blank form opens the previous saved edit screen', () => {
    const neighbors = placeNeighbors(rows, null)
    const hrefs = neighborHrefs('/sales/invoices', neighbors, undefined)
    expect(hrefs.previousHref).toBe('/sales/invoices/c/edit')
    expect(hrefs.forwardHref).toBeNull()
    expect(hrefs.previousTitle).toBe('Back to INV-003')
  })

  it('Forward from the newest saved record opens /new', () => {
    const neighbors = placeNeighbors(rows, 'c')
    const hrefs = neighborHrefs('/sales/invoices', neighbors, 'c')
    expect(hrefs.previousHref).toBe('/sales/invoices/b/edit')
    expect(hrefs.forwardHref).toBe('/sales/invoices/new')
    expect(hrefs.forwardTitle).toBe('Forward to a new form')
  })

  it('steps Forward between two saved records', () => {
    const neighbors = placeNeighbors(rows, 'a')
    const hrefs = neighborHrefs('/purchases/bills', neighbors, 'a')
    expect(hrefs.previousHref).toBeNull()
    expect(hrefs.forwardHref).toBe('/purchases/bills/b/edit')
    expect(hrefs.forwardTitle).toBe('Forward to INV-002')
  })

  it('uses an empty edit suffix for journal detail pages', () => {
    const neighbors = placeNeighbors(
      [
        { id: 'j1', number: 'JE-001' },
        { id: 'j2', number: 'JE-002' },
      ],
      'j1',
    )
    const hrefs = neighborHrefs('/journals', neighbors, 'j1', '')
    expect(hrefs.previousHref).toBeNull()
    expect(hrefs.forwardHref).toBe('/journals/j2')
  })

  it('Forward from the newest journal opens /journals/new', () => {
    const neighbors = placeNeighbors([{ id: 'j2', number: 'JE-002' }], 'j2')
    const hrefs = neighborHrefs('/journals', neighbors, 'j2', '')
    expect(hrefs.forwardHref).toBe('/journals/new')
  })

  it('handles missing neighbors on a blank form', () => {
    const hrefs = neighborHrefs('/sales/sales-receipts', undefined, undefined)
    expect(hrefs.previousHref).toBeNull()
    expect(hrefs.forwardHref).toBeNull()
  })
})
