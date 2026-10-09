// @vitest-environment happy-dom

import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let pathname = '/reports'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    createElement('a', { href }, children),
}))

const { GlobalMonthChart, showsBooksMonthChart } = await import(
  '@/components/layout/global-month-chart'
)

const data = {
  caption: 'This month · Oct 1, 2026 to Oct 31, 2026',
  currency: 'USD',
  income: '15720.00',
  expenses: '3294.28',
  net: '12425.72',
  openInvoices: 1471,
}

let root: Root | null = null
let host: HTMLDivElement | null = null

function text() {
  return document.body.textContent ?? ''
}

async function renderChart() {
  await act(async () => {
    root = createRoot(host!)
    root.render(createElement(GlobalMonthChart, { data }))
  })
}

describe('books this month chart path', () => {
  beforeEach(() => {
    pathname = '/reports'
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

  it('allows the chart only on the Reports home', () => {
    expect(showsBooksMonthChart('/reports')).toBe(true)
    expect(showsBooksMonthChart('/reports/')).toBe(true)
    for (const path of [
      '/reports/profit-loss',
      '/reports/balance-sheet',
      '/reports/profit-loss/detail',
      '/dashboard',
      '/sales',
      '/sales/reports',
      '/sales/invoices',
      '/purchases',
      '/purchases/reports',
      '/accounting',
      '/accounting/reports',
      '/banking',
      '/inventory',
      '/inventory/reports',
      '/pos',
      '/pos/reg-1',
      '/pos/orders',
      '/settings',
      '/help',
    ]) {
      expect(showsBooksMonthChart(path), path).toBe(false)
    }
  })

  it('renders the chart on /reports and keeps show and hide', async () => {
    window.localStorage.setItem('bp.month-chart.visible', '1')
    await renderChart()
    expect(text()).toContain('Books this month')
    expect(text()).toContain('Hide chart')
    expect(text()).toContain('Profit and loss')
    expect(text()).toContain('Balance sheet')
    expect(text()).toContain('1471 open invoices')

    const hide = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Hide chart'),
    )
    expect(hide).toBeTruthy()
    await act(async () => {
      hide!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(text()).toContain('Show chart')
    expect(text()).not.toContain('Books this month')
    expect(window.localStorage.getItem('bp.month-chart.visible')).toBe('0')
  })

  it('stays off every other page, including when it was left open', async () => {
    window.localStorage.setItem('bp.month-chart.visible', '1')
    for (const path of ['/dashboard', '/sales', '/accounting', '/reports/profit-loss', '/pos/reg-1']) {
      pathname = path
      await renderChart()
      expect(text(), path).not.toContain('Books this month')
      expect(text(), path).not.toContain('Hide chart')
      expect(text(), path).not.toContain('Show chart')
      expect(text(), path).not.toContain('Profit and loss')
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
  })
})
