import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const layer = (source: string, marker: string) => {
  const match = new RegExp(`className="${marker} relative z-(\\[?\\d+\\]?)`).exec(source)
  expect(match, marker).not.toBeNull()
  return Number(match![1].replace(/[[\]]/g, ''))
}

describe('header menus stay above the page', () => {
  const shell = read('components/layout/shell-chrome.tsx')
  const top = layer(shell, 'shell-topbar')
  const apps = layer(shell, 'shell-apps')
  const tabs = layer(shell, 'shell-tabs')

  it('stacks the bars top-down so a menu covers the bar beneath it', () => {
    expect(top).toBeGreaterThan(apps)
    expect(apps).toBeGreaterThan(tabs)
  })

  it('keeps every sticky page bar (POS sub-header included) below the header bars', () => {
    const pos = read('components/pos/pos-shell.tsx')
    const sticky = [...pos.matchAll(/sticky[^"]*z-(\d+)/g)].map((m) => Number(m[1]))
    expect(sticky.length).toBeGreaterThan(0)
    for (const z of sticky) expect(z).toBeLessThan(tabs)
  })
})
