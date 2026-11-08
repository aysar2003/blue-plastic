'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import {
  captureFromRow,
  currentListHref,
  matchesListReturn,
  readListReturn,
  writeListReturn,
} from '@/lib/list-return'
import { normalizeHref } from '@/lib/nav-trail'

/**
 * Remembers which report/register row opened a document, then on Back restores
 * the list scroll and marks that row with QuickBooks-style triangles.
 */
export function ListReturnRecorder() {
  return (
    <Suspense fallback={null}>
      <ListReturnRecorderInner />
    </Suspense>
  )
}

function ListReturnRecorderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const href = normalizeHref(search ? `${pathname}?${search}` : pathname)
  const restoreGen = useRef(0)

  // Capture before navigation: a drill link inside a data row.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const link = event.target.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement)) return
      const rawHref = link.getAttribute('href')
      if (!rawHref || !rawHref.startsWith('/') || rawHref.startsWith('//')) return

      const row = link.closest('[data-slot="table-row"]')
      if (!(row instanceof HTMLElement) || row.hasAttribute('data-column-band')) return

      let linkHref = rawHref
      try {
        const url = new URL(link.href, window.location.origin)
        linkHref = `${url.pathname}${url.search}`
      } catch {
        // Keep the attribute value.
      }

      const saved = captureFromRow(row, { listHref: currentListHref(), linkHref })
      if (saved) writeListReturn(saved)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // When the list screen opens again, put the viewport and marker back.
  useEffect(() => {
    const saved = readListReturn()
    if (!matchesListReturn(href, saved) || !saved) return

    const gen = ++restoreGen.current
    let stopScroll = false
    const started = Date.now()

    const clearMarks = () => {
      document.querySelectorAll('[data-list-return="true"]').forEach((node) => {
        node.removeAttribute('data-list-return')
      })
    }

    const findRow = (): HTMLElement | null => {
      const byId = document.querySelector(
        `[data-slot="table-row"][data-row-id="${cssEscape(saved.rowId)}"]`,
      )
      if (byId instanceof HTMLElement && !byId.hasAttribute('data-column-band')) return byId
      if (!saved.linkHref) return null
      const link = document.querySelector(
        `[data-slot="table-row"] a[href="${cssEscape(saved.linkHref)}"]`,
      )
      const row = link?.closest('[data-slot="table-row"]')
      return row instanceof HTMLElement && !row.hasAttribute('data-column-band') ? row : null
    }

    const restoreScroll = (row: HTMLElement | null) => {
      if (stopScroll) return
      if (saved.windowScrollY > 0) {
        window.scrollTo({ top: saved.windowScrollY })
      }
      const port =
        (row?.closest('[data-table-scroll]') as HTMLElement | null) ??
        (document.querySelector('[data-table-scroll]') as HTMLElement | null)
      if (port && saved.tableScrollTop > 0) {
        port.scrollTop = saved.tableScrollTop
      }
    }

    const mark = () => {
      if (restoreGen.current !== gen) return false
      const row = findRow()
      if (!row) return false
      clearMarks()
      row.setAttribute('data-list-return', 'true')
      restoreScroll(row)
      if (!stopScroll) {
        const port = row.closest('[data-table-scroll]') as HTMLElement | null
        if (port) {
          const rowTop = row.offsetTop
          const rowBottom = rowTop + row.offsetHeight
          if (rowTop < port.scrollTop || rowBottom > port.scrollTop + port.clientHeight) {
            port.scrollTop = Math.max(0, rowTop - Math.floor(port.clientHeight / 3))
          }
        }
      }
      return true
    }

    const tick = () => {
      if (restoreGen.current !== gen) return
      if (mark()) return
      if (Date.now() - started > 8000) {
        restoreScroll(null)
        return
      }
      window.setTimeout(tick, 100)
    }

    const onUserScroll = () => {
      stopScroll = true
    }
    window.addEventListener('wheel', onUserScroll, { once: true, passive: true })
    window.addEventListener('touchstart', onUserScroll, { once: true, passive: true })

    window.setTimeout(tick, 50)

    return () => {
      restoreGen.current += 1
      window.removeEventListener('wheel', onUserScroll)
      window.removeEventListener('touchstart', onUserScroll)
    }
  }, [href])

  return null
}

function cssEscape(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
