'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

const MIN = 176
const MAX = 520
const DEFAULT = 256

/**
 * Left list / right detail, with a drag handle between them — the same gesture
 * as widening a column in Excel. Width is remembered per screen.
 */
export function ContactSplit({
  storageKey,
  left,
  right,
}: {
  storageKey: string
  left: ReactNode
  right: ReactNode
}) {
  const shell = useRef<HTMLDivElement>(null)
  const widthRef = useRef(DEFAULT)
  const [width, setWidth] = useState(DEFAULT)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return
      const next = Number(stored)
      if (!Number.isFinite(next)) return
      const clamped = clamp(next)
      widthRef.current = clamped
      setWidth(clamped)
    } catch {
      // Private mode — keep the default.
    }
  }, [storageKey])

  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent) => {
      const box = shell.current?.getBoundingClientRect()
      if (!box) return
      const next = clamp(event.clientX - box.left)
      widthRef.current = next
      setWidth(next)
    }

    const onUp = () => {
      setDragging(false)
      try {
        localStorage.setItem(storageKey, String(widthRef.current))
      } catch {
        // Ignore quota / private mode.
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, storageKey])

  const persist = (next: number) => {
    const clamped = clamp(next)
    widthRef.current = clamped
    setWidth(clamped)
    try {
      localStorage.setItem(storageKey, String(clamped))
    } catch {
      // Ignore.
    }
  }

  return (
    <div ref={shell} className="flex min-h-0 flex-1">
      <aside className="flex min-h-0 shrink-0 flex-col border-r" style={{ width }}>
        {left}
      </aside>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize list and detail"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            persist(widthRef.current - 16)
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            persist(widthRef.current + 16)
          }
        }}
        className={cn(
          'group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent',
          'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border',
          'hover:after:w-0.5 hover:after:bg-primary/60 focus-visible:outline-none focus-visible:after:w-0.5 focus-visible:after:bg-primary',
          dragging && 'after:w-0.5 after:bg-primary',
        )}
      >
        <span className="pointer-events-none absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>
    </div>
  )
}

function clamp(value: number) {
  return Math.min(MAX, Math.max(MIN, value))
}
