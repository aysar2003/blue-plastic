import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))

vi.mock('@/app/(app)/settings/(work)/organization/actions', () => ({
  toggleModuleFlag: vi.fn(),
}))

import { AppLauncher } from '@/components/layout/app-launcher'
import { LAUNCHER_APPS } from '@/components/layout/launcher-apps'

describe('launcher labels', () => {
  const html = renderToStaticMarkup(
    createElement(AppLauncher, { eyebrow: 'Shop', title: 'Welcome', subtitle: 'Choose an app', apps: LAUNCHER_APPS }),
  )

  it('draws every app label with theme foreground so every skin stays readable', () => {
    for (const app of LAUNCHER_APPS) {
      const label = new RegExp(`<span class="([^"]*)">${app.label}</span>`).exec(html)
      expect(label, app.label).not.toBeNull()
      const cls = label![1].split(' ')
      expect(cls).toContain('font-semibold')
      expect(cls).toContain('text-foreground')
      expect(cls.some((c) => c.startsWith('text-foreground/'))).toBe(false)
    }
  })

  it('keeps blurbs on the muted token so light and night themes both read', () => {
    const blurb = /<span class="([^"]*)">Sell at the till<\/span>/.exec(html)
    expect(blurb).not.toBeNull()
    expect(blurb![1]).toContain('text-muted-foreground')
  })
})
