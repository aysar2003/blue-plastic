import { describe, expect, it } from 'vitest'

import {
  appForPath,
  doorHref,
  forgetHref,
  isRememberable,
  isSafeHref,
  journeyOwner,
  memoryKey,
  parseMemory,
  PLACE_TTL_MS,
  rememberPlace,
  rememberScroll,
  type AppMemory,
} from '@/lib/app-memory'
import { APP_ALSO, LAUNCHER_APPS } from '@/components/layout/launcher-apps'

const ROOTS = LAUNCHER_APPS.map((app) => ({ key: app.key, href: app.href, also: APP_ALSO[app.key] }))
const NOW = 1_800_000_000_000

/** Walk a sequence of screens the way the recorder does. */
function walk(steps: Array<{ href: string; via: 'app' | 'content' | 'other' }>) {
  let memory: AppMemory = {}
  let owner: string | null = null
  let previousPathname: string | null = null
  let at = NOW
  for (const step of steps) {
    const pathname = step.href.split('?')[0]
    const pathApp = appForPath(pathname, ROOTS)
    owner = journeyOwner({ previousOwner: owner, previousPathname, pathname, pathApp, arrival: step.via })
    previousPathname = pathname
    memory = rememberPlace(memory, { owner, pathApp, href: step.href, now: (at += 1000) })
  }
  return { memory, owner, at }
}

describe('app memory', () => {
  it('maps paths to their app, longest prefix first', () => {
    expect(appForPath('/customers', ROOTS)).toBe('customers')
    expect(appForPath('/customers/abc', ROOTS)).toBe('customers')
    expect(appForPath('/items/abc', ROOTS)).toBe('inventory')
    expect(appForPath('/accounts', ROOTS)).toBe('accounting')
    expect(appForPath('/reports/statements/customer', ROOTS)).toBe('reports')
    expect(appForPath('/dashboard', ROOTS)).toBeNull()
    expect(appForPath('/customersx', ROOTS)).toBeNull()
  })

  it('does not remember home, blank forms, print sheets or unsafe targets', () => {
    expect(isRememberable('/customers?id=1')).toBe(true)
    expect(isRememberable('/dashboard')).toBe(false)
    expect(isRememberable('/sales/invoices/new')).toBe(false)
    expect(isRememberable('/sales/invoices/abc/edit')).toBe(false)
    expect(isRememberable('/sales/invoices/abc/print')).toBe(false)
    expect(isSafeHref('//evil.example')).toBe(false)
    expect(isSafeHref('https://evil.example')).toBe(false)
    expect(isSafeHref('/a\\b')).toBe(false)
  })

  it('Customers -> customer -> QuickReport -> Sales: Customers reopens that report, then the customer, then the start', () => {
    const report = '/reports/statements/customer?customerId=c1&view=detail&period=all-dates'
    const { memory, at } = walk([
      { href: '/customers', via: 'app' },
      { href: '/customers?id=c1', via: 'content' },
      { href: '/customers?id=c1&tab=notes', via: 'content' },
      { href: report, via: 'content' },
      { href: '/sales', via: 'app' },
    ])
    expect(memory.customers).toMatchObject({ href: report, home: '/customers?id=c1&tab=notes' })
    // Reports also remembers the statement, under its own path.
    expect(memory.reports?.href).toBe(report)
    const door = (currentHref: string) =>
      doorHref({ memory, key: 'customers', root: '/customers', currentHref, now: at })
    expect(door('/sales')).toBe(report)
    // Already on the report: the Customers door goes to the customer screen…
    expect(door(report)).toBe('/customers?id=c1&tab=notes')
    // …and from there, once that is remembered as the place, back to the start.
    const there = rememberPlace(memory, {
      owner: 'customers',
      pathApp: 'customers',
      href: '/customers?id=c1&tab=notes',
      now: at + 1,
    })
    expect(doorHref({ memory: there, key: 'customers', root: '/customers', currentHref: '/customers?id=c1&tab=notes', now: at + 2 })).toBe('/customers')
  })

  it('the app switcher, search or a typed URL start a new journey', () => {
    const { memory } = walk([
      { href: '/vendors?id=v1', via: 'app' },
      { href: '/sales/invoices', via: 'other' },
    ])
    expect(memory.vendors?.href).toBe('/vendors?id=v1')
    expect(memory.sales?.href).toBe('/sales/invoices')
  })

  it('a query-only change keeps the journey even without a click', () => {
    const report = '/reports/statements/vendor?vendorId=v1&period=all-dates'
    const { memory } = walk([
      { href: '/vendors?id=v1', via: 'app' },
      { href: report, via: 'content' },
      { href: '/reports/statements/vendor?vendorId=v1&period=this-month', via: 'other' },
    ])
    expect(memory.vendors?.href).toBe('/reports/statements/vendor?vendorId=v1&period=this-month')
  })

  it('blank forms do not overwrite the place', () => {
    const { memory } = walk([
      { href: '/sales/invoices?status=open', via: 'app' },
      { href: '/sales/invoices/new', via: 'content' },
    ])
    expect(memory.sales?.href).toBe('/sales/invoices?status=open')
  })

  it('keeps scroll for the open place only', () => {
    const memory: AppMemory = { customers: { href: '/customers?id=c1', at: NOW }, sales: { href: '/sales', at: NOW } }
    const next = rememberScroll(memory, '/customers?id=c1', 640.4)
    expect(next.customers?.scrollY).toBe(640)
    expect(next.sales?.scrollY).toBeUndefined()
    expect(rememberScroll(next, '/customers?id=c1', 640)).toBe(next)
  })

  it('forgets a deleted record and falls back to the app screen, then the start', () => {
    const memory: AppMemory = {
      sales: { href: '/sales/invoices/gone', home: '/sales/invoices?status=open', at: NOW },
      payments: { href: '/sales/invoices/gone', home: '/sales/invoices/gone', at: NOW },
    }
    const next = forgetHref(memory, '/sales/invoices/gone')
    expect(next.sales).toEqual({ href: '/sales/invoices?status=open', home: '/sales/invoices?status=open', at: NOW })
    expect(next.payments).toBeUndefined()
    expect(doorHref({ memory: next, key: 'payments', root: '/payments', currentHref: null, now: NOW })).toBe('/payments')
  })

  it('expires old places and survives junk in storage', () => {
    expect(parseMemory('not json', NOW)).toEqual({})
    expect(parseMemory('[1,2]', NOW)).toEqual({})
    const raw = JSON.stringify({
      customers: { href: '/customers?id=c1', home: '//evil', at: NOW - 1000, scrollY: 300 },
      vendors: { href: '/vendors?id=v1', at: NOW - PLACE_TTL_MS - 1 },
      sales: { href: 'https://evil.example', at: NOW },
      pos: 'nope',
    })
    expect(parseMemory(raw, NOW)).toEqual({ customers: { href: '/customers?id=c1', at: NOW - 1000, scrollY: 300 } })
    expect(doorHref({ memory: { a: { href: '/x', at: NOW - PLACE_TTL_MS - 5 } }, key: 'a', root: '/a', currentHref: null, now: NOW })).toBe('/a')
  })

  it('keeps each user apart in the same browser', () => {
    expect(memoryKey('u1')).not.toBe(memoryKey('u2'))
  })
})
