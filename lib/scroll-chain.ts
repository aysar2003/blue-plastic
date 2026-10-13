/**
 * Nested scroll chaining for the whole app.
 *
 * Uses elements under the pointer (not only DOM ancestors) so a portaled
 * combobox list can scroll with the wheel inside a dialog, then pass leftover
 * delta to the dialog, then the page — both directions.
 *
 * Wheel is applied manually: native wheel often fails on overflow lists once a
 * dialog locks body scroll (drag thumb still works; wheel does not).
 */

const EPSILON = 0.5

export function installScrollChain(signal?: AbortSignal): void {
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.defaultPrevented) return
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return

    const chain = scrollersUnderPointer(event.clientX, event.clientY)
    if (chain.length === 0) return

    // Plain page scroll — leave it to the browser.
    if (chain.length === 1 && chain[0] === document.scrollingElement) return

    let remaining = event.deltaY
    if (remaining === 0) return
    if (event.deltaMode === 1) remaining *= 16
    if (event.deltaMode === 2) remaining *= chain[0]!.clientHeight

    const updates: { el: HTMLElement; top: number }[] = []
    for (const el of chain) {
      if (Math.abs(remaining) < EPSILON) break
      if (isScrollLocked(el)) continue

      const max = el.scrollHeight - el.clientHeight
      if (max <= 0) continue

      const next = clamp(el.scrollTop + remaining, 0, max)
      const applied = next - el.scrollTop
      if (applied !== 0) {
        updates.push({ el, top: next })
        remaining -= applied
      }
    }

    if (updates.length === 0) return

    event.preventDefault()
    for (const update of updates) update.el.scrollTop = update.top
  }

  document.addEventListener('wheel', onWheel, { passive: false, capture: true, signal })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isOverflowScroller(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el)
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false
  return el.scrollHeight > el.clientHeight + 1
}

function isScrollLocked(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el)
  return overflowY === 'hidden' || overflowY === 'clip'
}

/**
 * Topmost → outermost scrollports under the cursor, including portals stacked
 * over a dialog (listbox is not a DOM child of the dialog).
 */
function scrollersUnderPointer(clientX: number, clientY: number): HTMLElement[] {
  const hits = document.elementsFromPoint(clientX, clientY)
  const chain: HTMLElement[] = []
  const seen = new Set<HTMLElement>()

  for (const hit of hits) {
    let node: Element | null = hit
    while (node) {
      if (node instanceof HTMLElement && isOverflowScroller(node) && !seen.has(node)) {
        seen.add(node)
        chain.push(node)
      }
      node = node.parentElement
    }
  }

  const doc = document.scrollingElement
  if (
    doc instanceof HTMLElement &&
    !seen.has(doc) &&
    !isScrollLocked(doc) &&
    doc.scrollHeight > doc.clientHeight + 1
  ) {
    chain.push(doc)
  }

  return chain
}
