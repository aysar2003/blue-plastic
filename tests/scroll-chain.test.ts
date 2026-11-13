// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'

import { installScrollChain } from '@/lib/scroll-chain'

afterEach(() => {
  document.body.replaceChildren()
})

describe('side rail wheel', () => {
  it('scrolls the rail list and does not move the page', () => {
    document.body.innerHTML = `
      <aside id="app-side-rail"><div data-side-scroll></div></aside>
    `
    const list = document.querySelector('[data-side-scroll]') as HTMLElement
    Object.defineProperty(list, 'scrollHeight', { value: 800, configurable: true })
    Object.defineProperty(list, 'clientHeight', { value: 200, configurable: true })
    document.elementFromPoint = () => list

    const ac = new AbortController()
    installScrollChain(ac.signal)
    const page = document.scrollingElement as HTMLElement
    const before = page.scrollTop
    const event = new WheelEvent('wheel', {
      deltaY: 40,
      clientX: 8,
      clientY: 40,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(list.scrollTop).toBe(40)
    expect(page.scrollTop).toBe(before)
    ac.abort()
  })

  it('does not move the page when a side menu scroll is finished', () => {
    document.body.innerHTML = `
      <div data-scroll-isolate><ul data-menu></ul></div>
      <main>page</main>
    `
    const list = document.querySelector('[data-menu]') as HTMLElement
    Object.defineProperty(list, 'scrollHeight', { value: 400, configurable: true })
    Object.defineProperty(list, 'clientHeight', { value: 200, configurable: true })
    list.style.overflowY = 'auto'
    list.scrollTop = 200
    document.elementFromPoint = () => list

    const ac = new AbortController()
    installScrollChain(ac.signal)
    const page = document.scrollingElement as HTMLElement
    page.scrollTop = 80
    const event = new WheelEvent('wheel', {
      deltaY: 120,
      clientX: 40,
      clientY: 40,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(list.scrollTop).toBe(200)
    expect(page.scrollTop).toBe(80)
    ac.abort()
  })

  it('does not claim the wheel when the pointer is off the rail', () => {
    document.body.innerHTML = `<main>page</main>`
    document.elementFromPoint = () => document.querySelector('main')
    document.elementsFromPoint = () => [document.querySelector('main')!]

    const ac = new AbortController()
    installScrollChain(ac.signal)
    const event = new WheelEvent('wheel', {
      deltaY: 40,
      clientX: 400,
      clientY: 40,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    ac.abort()
  })
})
