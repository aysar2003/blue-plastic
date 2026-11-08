// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'

import {
  captureFromRow,
  matchesListReturn,
  parseListReturn,
  type ListReturn,
} from '@/lib/list-return'

const BASE: ListReturn = {
  listHref: '/reports/general-ledger?from=2026-01-01',
  rowId: '/journals/j1#3',
  linkHref: '/journals/j1',
  tableScrollTop: 420,
  windowScrollY: 80,
  at: 1_800_000_000_000,
}

describe('list return', () => {
  it('parses a valid snapshot and sorts the list query', () => {
    const raw = JSON.stringify({
      ...BASE,
      listHref: '/reports/general-ledger?b=2&a=1',
    })
    expect(parseListReturn(raw)).toEqual({
      ...BASE,
      listHref: '/reports/general-ledger?a=1&b=2',
    })
  })

  it('drops malformed or unsafe snapshots', () => {
    expect(parseListReturn(null)).toBeNull()
    expect(parseListReturn('{')).toBeNull()
    expect(parseListReturn(JSON.stringify({ ...BASE, listHref: '//evil' }))).toBeNull()
    expect(parseListReturn(JSON.stringify({ ...BASE, rowId: '' }))).toBeNull()
    expect(parseListReturn(JSON.stringify({ ...BASE, at: 'nope' }))).toBeNull()
  })

  it('clamps scroll offsets and ignores bad link targets', () => {
    const raw = JSON.stringify({
      ...BASE,
      tableScrollTop: -12.7,
      windowScrollY: 99.4,
      linkHref: 'https://evil.example',
    })
    expect(parseListReturn(raw)).toEqual({
      listHref: BASE.listHref,
      rowId: BASE.rowId,
      tableScrollTop: 0,
      windowScrollY: 99,
      at: BASE.at,
    })
  })

  it('matches only when the open screen is the saved list', () => {
    expect(matchesListReturn('/reports/general-ledger?from=2026-01-01', BASE)).toBe(true)
    expect(matchesListReturn('/reports/general-ledger?b=2&a=1', {
      ...BASE,
      listHref: '/reports/general-ledger?a=1&b=2',
    })).toBe(true)
    expect(matchesListReturn('/journals/j1', BASE)).toBe(false)
    expect(matchesListReturn('/reports/general-ledger?from=2026-01-01', null)).toBe(false)
  })

  it('captures scroll and row id from a table row', () => {
    const port = document.createElement('div')
    port.setAttribute('data-table-scroll', '')
    port.scrollTop = 640
    const row = document.createElement('tr')
    row.setAttribute('data-slot', 'table-row')
    row.setAttribute('data-row-id', 'line-9')
    port.appendChild(row)
    document.body.appendChild(port)

    const saved = captureFromRow(row, {
      listHref: '/accounts/a1?tab=register',
      linkHref: '/journals/j9',
      now: BASE.at,
    })
    expect(saved).toEqual({
      listHref: '/accounts/a1?tab=register',
      rowId: 'line-9',
      linkHref: '/journals/j9',
      tableScrollTop: 640,
      windowScrollY: 0,
      at: BASE.at,
    })

    row.setAttribute('data-column-band', '')
    expect(captureFromRow(row, { listHref: '/accounts/a1', linkHref: '/journals/j9' })).toBeNull()

    port.remove()
  })
})
