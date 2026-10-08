import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))

import { AppLauncher } from '@/components/layout/app-launcher'
import { LAUNCHER_APPS } from '@/components/layout/launcher-apps'

describe('launcher labels', () => {
  const html = renderToStaticMarkup(
    createElement(AppLauncher, { eyebrow: 'Shop', title: 'Welcome', subtitle: 'Choose an app', apps: LAUNCHER_APPS }),
  )

  it('draws every app label near-black and semibold on light themes, light on dark themes', () => {
    for (const app of LAUNCHER_APPS) {
      const label = new RegExp(`<span class="([^"]*)">${app.label}</span>`).exec(html)
      expect(label, app.label).not.toBeNull()
      const cls = label![1].split(' ')
      expect(cls).toContain('font-semibold')
      expect(cls).toContain('text-[#141418]')
      expect(cls).toContain('dark:text-foreground')
      expect(cls.some((c) => c.startsWith('text-foreground/'))).toBe(false)
    }
  })

  it('keeps blurbs readable: dark grey on light, muted on dark', () => {
    const blurb = /<span class="([^"]*)">Sell at the till<\/span>/.exec(html)
    expect(blurb).not.toBeNull()
    expect(blurb![1]).toContain('text-[#4a4a54]')
    expect(blurb![1]).toContain('dark:text-muted-foreground')
  })
})
