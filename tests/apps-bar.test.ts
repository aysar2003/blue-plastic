// @vitest-environment happy-dom

import { createElement, type ReactNode } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let pathname = '/sales/invoices'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    title,
  }: {
    href: string
    children: ReactNode
    title?: string
  }) => createElement('a', { href, title }, children),
}))

const {
  ActiveAppLink,
  AppsBarToggle,
  AppsNavLayoutToggle,
  useAppsBarHidden,
  useAppsNavLayout,
  APPS_BAR_STORAGE_KEY,
  APPS_NAV_LAYOUT_KEY,
} = await import('@/components/layout/apps-bar')
const { HeaderApps } = await import('@/components/layout/app-launcher')
const { SideAppsRail, SIDE_APPS_PIN_KEY } = await import(
  '@/components/layout/side-apps-rail'
)
const { LAUNCHER_APPS } = await import('@/components/layout/launcher-apps')

const permissions = LAUNCHER_APPS.flatMap((app) => (app.permission ? [app.permission] : []))

function Bar() {
  const { hidden, toggle } = useAppsBarHidden()
  const { layout, toggle: toggleLayout } = useAppsNavLayout()
  const side = layout === 'side'
  return createElement(
    'div',
    null,
    side
      ? null
      : createElement(ActiveAppLink, { permissions, barHidden: hidden }),
    side ? null : createElement(AppsBarToggle, { hidden, onToggle: toggle }),
    createElement(AppsNavLayoutToggle, { layout, onToggle: toggleLayout }),
    side
      ? createElement(SideAppsRail, { permissions })
      : createElement(
          'div',
          { id: 'app-icon-bar', hidden: hidden || undefined },
          hidden ? null : createElement(HeaderApps, { permissions }),
        ),
  )
}

let root: Root | null = null
let host: HTMLDivElement | null = null

function text() {
  return document.body.textContent ?? ''
}

function buttonNamed(label: string) {
  return [...document.querySelectorAll('button')].find((button) => button.textContent?.includes(label))
}

async function renderBar() {
  await act(async () => {
    root = createRoot(host!)
    root.render(createElement(Bar))
  })
}

describe('app icon bar', () => {
  beforeEach(() => {
    pathname = '/sales/invoices'
    window.localStorage.clear()
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    root = null
    host?.remove()
    host = null
  })

  it('hides the icon row, keeps the open app, and brings the row back', async () => {
    window.localStorage.setItem(APPS_NAV_LAYOUT_KEY, 'top')
    await renderBar()
    expect(text()).toContain('Hide apps')
    expect(text()).toContain('Sales')
    expect(text()).toContain('Point of Sale')
    expect(text()).toContain('Purchases')
    expect(document.getElementById('app-icon-bar')?.hidden).toBe(false)

    await act(async () => {
      buttonNamed('Hide apps')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(text()).toContain('Show apps')
    expect(text()).not.toContain('Hide apps')
    expect(document.getElementById('app-icon-bar')?.hidden).toBe(true)
    const back = document.querySelector('a[title="Back to Sales"]')
    expect(back?.getAttribute('href')).toBe('/sales')
    expect(back?.textContent).toBe('Sales')
    expect(window.localStorage.getItem(APPS_BAR_STORAGE_KEY)).toBe('1')

    await act(async () => {
      buttonNamed('Show apps')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(text()).toContain('Hide apps')
    expect(text()).toContain('Sales')
    expect(text()).toContain('Point of Sale')
    expect(document.querySelector('a[title="Back to Sales"]')).toBeNull()
    expect(document.getElementById('app-icon-bar')?.hidden).toBe(false)
    expect(window.localStorage.getItem(APPS_BAR_STORAGE_KEY)).toBe('0')
  })

  it('keeps every top-level app visible when system apps are on top', async () => {
    pathname = '/banking'
    window.localStorage.setItem(APPS_NAV_LAYOUT_KEY, 'top')
    await renderBar()
    expect(text()).toContain('Banking')
    expect(text()).toContain('Sales')
    expect(text()).toContain('Inventory')
    expect(text()).toContain('Reports')
  })

  it('stays hidden on the next visit and still offers the app you were in', async () => {
    window.localStorage.setItem(APPS_NAV_LAYOUT_KEY, 'top')
    window.localStorage.setItem(APPS_BAR_STORAGE_KEY, '1')
    await renderBar()
    expect(text()).toContain('Show apps')
    expect(document.querySelector('a[title="Back to Sales"]')?.getAttribute('href')).toBe('/sales')
  })

  it('does not invent an app chip on the apps home', async () => {
    pathname = '/dashboard'
    window.localStorage.setItem(APPS_BAR_STORAGE_KEY, '1')
    await renderBar()
    // Shell hides apps chrome on /dashboard; this unit harness still mounts the bar.
    expect(document.querySelector('a[title^="Back to"]')).toBeNull()
  })

  it('switches system apps between side rail and top row', async () => {
    await renderBar()
    // Default: system apps on the side; header keeps the open app’s sections.
    expect(text()).toContain('Apps on top')
    expect(document.getElementById('app-side-rail')).not.toBeNull()
    expect(document.getElementById('app-icon-bar')).toBeNull()

    await act(async () => {
      buttonNamed('Apps on top')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(text()).toContain('Apps on side')
    expect(text()).toContain('Hide apps')
    expect(document.getElementById('app-icon-bar')).not.toBeNull()
    expect(document.getElementById('app-side-rail')).toBeNull()
    expect(window.localStorage.getItem(APPS_NAV_LAYOUT_KEY)).toBe('top')

    await act(async () => {
      buttonNamed('Apps on side')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(text()).toContain('Apps on top')
    expect(document.getElementById('app-side-rail')).not.toBeNull()
    expect(document.getElementById('app-icon-bar')).toBeNull()
    expect(window.localStorage.getItem(APPS_NAV_LAYOUT_KEY)).toBe('side')
  })

  it('keeps the side rail after a reload', async () => {
    window.localStorage.setItem(APPS_NAV_LAYOUT_KEY, 'side')
    await renderBar()
    expect(text()).toContain('Apps on top')
    expect(document.getElementById('app-side-rail')).not.toBeNull()
    expect(document.getElementById('app-icon-bar')).toBeNull()
  })

  it('opens the side rail over the page, then pins it like QuickBooks', async () => {
    window.localStorage.setItem(APPS_NAV_LAYOUT_KEY, 'side')
    await renderBar()
    const rail = document.getElementById('app-side-rail')
    expect(rail?.getAttribute('data-mode')).toBe('icons')
    expect(rail?.getAttribute('data-docked')).toBeNull()
    expect(document.querySelector('#app-side-rail [data-side-expanded]')).toBeNull()

    await act(async () => {
      rail!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
    })
    expect(rail?.getAttribute('data-mode')).toBe('overlay')
    expect(document.querySelector('#app-side-rail [data-side-expanded]')).not.toBeNull()

    await act(async () => {
      rail!.dispatchEvent(
        new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }),
      )
    })
    expect(rail?.getAttribute('data-mode')).toBe('icons')

    await act(async () => {
      document
        .querySelector('button[aria-label="Open menu"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(rail?.getAttribute('data-mode')).toBe('overlay')
    expect(rail?.getAttribute('data-docked')).toBeNull()

    await act(async () => {
      document
        .querySelector('button[aria-label="Pin menu open"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(rail?.getAttribute('data-mode')).toBe('pinned')
    expect(rail?.getAttribute('data-docked')).toBe('true')
    expect(window.localStorage.getItem(SIDE_APPS_PIN_KEY)).toBe('1')

    await act(async () => {
      document
        .querySelector('button[aria-label="Close menu"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(rail?.getAttribute('data-mode')).toBe('icons')
    expect(window.localStorage.getItem(SIDE_APPS_PIN_KEY)).toBe('0')
  })

  it('keeps a pinned side menu after a reload', async () => {
    window.localStorage.setItem(APPS_NAV_LAYOUT_KEY, 'side')
    window.localStorage.setItem(SIDE_APPS_PIN_KEY, '1')
    await renderBar()
    expect(document.getElementById('app-side-rail')?.getAttribute('data-mode')).toBe('pinned')
    expect(document.getElementById('app-side-rail')?.getAttribute('data-docked')).toBe('true')
  })
})
