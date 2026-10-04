import { describe, expect, it } from 'vitest'

import { earlierScreen, parentOf, rememberScreen } from '@/lib/nav-trail'

describe('back', () => {
  it('returns to the screen that opened this one', () => {
    const trail = rememberScreen(rememberScreen([], '/sales/invoices'), '/sales/invoices/inv-1')
    expect(earlierScreen(trail, '/sales/invoices/inv-1')).toBe('/sales/invoices')
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
})