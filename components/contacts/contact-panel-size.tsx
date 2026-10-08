'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

import {
  clampFrameHeight,
  clampProfileHeight,
  defaultFrameHeight,
  defaultProfileHeight,
  parseStoredHeight,
} from '@/lib/contact-panel-size'
import { cn } from '@/lib/utils'

/* --- Remembered heights (per browser) --------------------------------------- */

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener('storage', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

function readStored(key: string): number | null {
  try {
    return parseStoredHeight(window.localStorage.getItem(key))
  } catch {
    return null
  }
}

function writeStored(key: string, value: number | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, String(Math.round(value)))
  } catch {
    // Private mode or quota: the size just is not remembered.
  }
  for (const listener of listeners) listener()
}

function useStoredHeight(key: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  )
}

/** Vertical drag: reports the live height while dragging, the final one on release. */
function startRowDrag(
  event: React.PointerEvent,
  startHeight: number,
  clamp: (height: number) => number,
  onMove: (height: number) => void,
  onEnd: (height: number) => void,
) {
  event.preventDefault()
  const startY = event.clientY
  let last = clamp(startHeight)
  const move = (moveEvent: PointerEvent) => {
    last = clamp(startHeight + moveEvent.clientY - startY)
    onMove(last)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    onEnd(last)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

const HANDLE =
  'group flex shrink-0 cursor-row-resize touch-none items-center justify-center outline-none hover:bg-primary/10 focus-visible:bg-primary/15'

/* --- The whole panel ---------------------------------------------------------- */

/**
 * The Customers / Vendors centre panel. Fills the window from its top down (or
 * about a screenful on a short laptop screen), and can be dragged taller or
 * shorter from its bottom edge; the height is remembered in this browser.
 * Double-click the edge to go back to fitting the window.
 */
export function ContactCenterFrame({
  storageKey,
  className,
  children,
}: {
  storageKey: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const stored = useStoredHeight(storageKey)
  const [fit, setFit] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  useEffect(() => {
    const measure = () => {
      const element = ref.current
      if (!element) return
      const top = element.getBoundingClientRect().top + window.scrollY
      setFit(defaultFrameHeight(window.innerHeight, top))
    }
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [])

  const height = dragging ?? (stored === null ? fit : clampFrameHeight(stored))
  const current = () => ref.current?.getBoundingClientRect().height ?? height ?? 480

  return (
    <section
      ref={ref}
      data-contact-frame
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-card',
        height === null && 'h-[calc(100dvh-7.25rem)]',
        className,
      )}
      style={height === null ? undefined : { height }}
    >
      {children}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize panel height"
        aria-valuenow={height ?? undefined}
        tabIndex={0}
        title="Drag to make the panel taller or shorter · double-click to fit the window"
        data-frame-handle
        className={cn(HANDLE, 'h-3 border-t bg-muted/40')}
        onPointerDown={(event) =>
          startRowDrag(event, current(), clampFrameHeight, setDragging, (final) => {
            writeStored(storageKey, final)
            setDragging(null)
          })
        }
        onDoubleClick={() => writeStored(storageKey, null)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault()
          writeStored(storageKey, clampFrameHeight(current() + (event.key === 'ArrowDown' ? 24 : -24)))
        }}
      >
        <span className="h-1 w-12 rounded-full bg-border group-hover:bg-primary/60 group-focus-visible:bg-primary" />
      </div>
    </section>
  )
}

/* --- Information block vs. transactions ------------------------------------- */

/**
 * The "Customer information" / "Vendor information" block at the top of the
 * detail pane. It takes at most a third of the pane until dragged, scrolling
 * inside, so the transactions table underneath always has room; drag the line
 * under it to trade rows for information. Remembered in this browser;
 * double-click the line to go back.
 */
export function ResizableProfile({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const stored = useStoredHeight(storageKey)
  const [pane, setPane] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const observer = new ResizeObserver(([entry]) => setPane(entry.contentRect.height))
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  const chosen = dragging ?? stored
  const style =
    pane === null
      ? undefined
      : chosen === null
        ? { maxHeight: defaultProfileHeight(pane) }
        : { height: clampProfileHeight(chosen, pane) }
  const clamp = (height: number) => clampProfileHeight(height, pane ?? 600)
  const current = () => ref.current?.getBoundingClientRect().height ?? 160

  return (
    <>
      <div ref={ref} data-contact-profile className="shrink-0 overflow-y-auto" style={style}>
        {children}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize information and transactions"
        tabIndex={0}
        title="Drag to show more transactions or more information · double-click to reset"
        data-profile-handle
        className={cn(HANDLE, 'relative z-[1] -mt-px h-2 border-y bg-muted/30')}
        onPointerDown={(event) =>
          startRowDrag(event, current(), clamp, setDragging, (final) => {
            writeStored(storageKey, final)
            setDragging(null)
          })
        }
        onDoubleClick={() => writeStored(storageKey, null)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault()
          writeStored(storageKey, clamp(current() + (event.key === 'ArrowDown' ? 24 : -24)))
        }}
      >
        <span className="h-0.5 w-10 rounded-full bg-border group-hover:bg-primary/60 group-focus-visible:bg-primary" />
      </div>
    </>
  )
}
