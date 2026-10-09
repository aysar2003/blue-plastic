import { describe, expect, it } from 'vitest'

import {
  earlierScreen,
  normalizeHref,
  parentOf,
  popScreen,
  rememberScreen,
} from '@/lib/nav-trail'

describe('back', () => {
  it('returns to the screen that opened this one', () => {
    const trail = rememberScreen(rememberScreen([], '/sales/invoices'), '/sales/invoices/inv-1')
    expect(earlierScreen(trail, '/sales/invoices/inv-1')).toBe('/sales/invoices')
  })

  it('returns to the POS till after opening a quotation from it', () => {
    const trail = rememberScreen(
      rememberScreen([], '/pos/reg-1'),
      '/sales/estimates/new',
    )
    const { target, trail: next } = popScreen(trail, '/sales/estimates/new')
    expect(target).toBe('/pos/reg-1')
    expect(next).toEqual(['/pos/reg-1'])
  })

  it('drops the screens that came after a return', () => {
    const opened = rememberScreen(rememberScreen([], '/customers'), '/customers/c-1')
    const returned = rememberScreen(opened, '/customers')
    expect(returned).toEqual(['/customers'])
    expect(earlierScreen(returned, '/customers')).toBeNull()
  })

  it('steps up to the list when nothing was opened before', () => {
    expect(parentOf('/sales/invoices/new')).toBe('/sales/invoices')
    expect(earlierScreen(['/sales/invoices/new'], '/sales/invoices/new')).toBeNull()
  })

  it('normalizes query order so Back still matches', () => {
    expect(normalizeHref('/customers?b=2&a=1')).toBe('/customers?a=1&b=2')
    const trail = rememberScreen([], '/customers?b=2&a=1')
    expect(trail).toEqual(['/customers?a=1&b=2'])
    expect(popScreen(trail, '/customers?a=1&b=2').target).toBeNull()
  })

  it('pops using the stack end when current href was not recorded yet', () => {
    const trail = ['/pos/reg-1', '/sales/estimates/new']
    // Current has an extra param the recorder has not written yet.
    const { target } = popScreen(trail, '/sales/estimates/new?customerId=c1')
    expect(target).toBe('/pos/reg-1')
  })
})
