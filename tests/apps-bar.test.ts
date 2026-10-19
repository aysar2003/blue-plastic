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

vi.mock('@/app/(app)/settings/(work)/organization/actions', () => ({
  toggleModuleFlag: vi.fn(),
}))

const { ActiveAppLink, AppsBarToggle, useAppsBarHidden, APPS_BAR_STORAGE_KEY } = await import(
  '@/components/layout/apps-bar'
)
const { HeaderApps } = await import('@/components/layout/app-launcher')
const { LAUNCHER_APPS } = await import('@/components/layout/launcher-apps')

const permissions = LAUNCHER_APPS.flatMap((app) => (app.permission ? [app.permission] : []))

function Bar() {
  const { hidden, toggle } = useAppsBarHidden()
  return createElement(
    'div',
    null,
    createElement(ActiveAppLink, { permissions, barHidden: hidden }),
    createElement(AppsBarToggle, { hidden, onToggle: toggle }),
    createElement(
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
    await renderBar()
    expect(text()).toContain('Hide apps')
    expect(text()).toContain('Point of Sale')
    expect(document.getElementById('app-icon-bar')?.hidden).toBe(false)

    await act(async () => {
      buttonNamed('Hide apps')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(text()).toContain('Show apps')
    expect(text()).not.toContain('Point of Sale')
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
    expect(text()).toContain('Point of Sale')
    expect(document.querySelector('a[title="Back to Sales"]')).toBeNull()
    expect(document.getElementById('app-icon-bar')?.hidden).toBe(false)
    expect(window.localStorage.getItem(APPS_BAR_STORAGE_KEY)).toBe('0')
  })

  it('stays hidden on the next visit and still offers the app you were in', async () => {
    window.localStorage.setItem(APPS_BAR_STORAGE_KEY, '1')
    await renderBar()
    expect(text()).toContain('Show apps')
    expect(text()).not.toContain('Point of Sale')
    expect(document.querySelector('a[title="Back to Sales"]')?.getAttribute('href')).toBe('/sales')
  })

  it('does not invent an app chip on the apps home', async () => {
    pathname = '/dashboard'
    window.localStorage.setItem(APPS_BAR_STORAGE_KEY, '1')
    await renderBar()
    expect(text()).toContain('Show apps')
    expect(document.querySelector('a[title^="Back to"]')).toBeNull()
  })
})
