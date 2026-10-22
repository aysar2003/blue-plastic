import { afterEach, describe, expect, it } from 'vitest'

import {
  closeTopDialog,
  openDialogCount,
  registerDialogCloser,
  resetDialogStack,
} from '@/lib/dialog-stack'
import { popScreen, rememberScreen } from '@/lib/nav-trail'

describe('dialog stack + Back', () => {
  afterEach(() => {
    resetDialogStack()
  })

  it('closes the top dialog before leaving the page', () => {
    const closed: string[] = []
    registerDialogCloser(() => closed.push('page-form'))
    registerDialogCloser(() => closed.push('nested-form'))

    expect(openDialogCount()).toBe(2)
    expect(closeTopDialog()).toBe(true)
    expect(closed).toEqual(['nested-form'])
    expect(openDialogCount()).toBe(1)

    expect(closeTopDialog()).toBe(true)
    expect(closed).toEqual(['nested-form', 'page-form'])
    expect(openDialogCount()).toBe(0)
  })

  it('returns false when no dialog is open so route Back can run', () => {
    expect(closeTopDialog()).toBe(false)
  })

  it('after dialogs are gone, Back returns to the previous screen', () => {
    const trail = rememberScreen(
      rememberScreen([], '/sales/invoices'),
      '/sales/invoices/new',
    )
    expect(popScreen(trail, '/sales/invoices/new').target).toBe('/sales/invoices')
  })

  it('unregister after X close does not break the stack', () => {
    const closed: string[] = []
    const unreg = registerDialogCloser(() => closed.push('a'))
    registerDialogCloser(() => closed.push('b'))
    expect(closeTopDialog()).toBe(true)
    expect(closed).toEqual(['b'])
    unreg()
    expect(openDialogCount()).toBe(0)
  })
})
