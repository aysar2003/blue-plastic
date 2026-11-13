'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'

import { floatingPanelZIndex } from '@/lib/dialog-stack'
import { cn } from '@/lib/utils'

type Anchor = {
  top: number
  left: number
  zIndex: number
}

/**
 * A fixed panel portaled to `document.body`, anchored under a trigger
 * (or to its right when `placement="right"`).
 * Use for menus and column pickers that would otherwise clip under
 * `overflow-hidden` ancestors or paint beneath open dialogs.
 */
export function PortaledFloatingPanel({
  open,
  anchorRef,
  onClose,
  align = 'start',
  placement = 'bottom',
  scrollIsolate = false,
  className,
  children,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onClose?: () => void
  align?: 'start' | 'end'
  /** Bottom under the trigger, or to its right (side app rail). */
  placement?: 'bottom' | 'right'
  /** Wheel stays in this panel and does not move the page behind it. */
  scrollIsolate?: boolean
  className?: string
  children: React.ReactNode
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = React.useState<Anchor>()

  const place = React.useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = 8
    const panelWidth = panelRef.current?.offsetWidth || Math.max(rect.width, 176)
    const rawHeight = panelRef.current?.scrollHeight || panelRef.current?.offsetHeight || 240
    const availableH = Math.max(120, window.innerHeight - margin * 2)
    const panelHeight = Math.min(rawHeight, availableH)
    let left: number
    let top: number
    if (placement === 'right') {
      left = Math.min(Math.max(margin, rect.right + 8), window.innerWidth - panelWidth - margin)
      top = Math.min(Math.max(margin, rect.top), window.innerHeight - panelHeight - margin)
    } else {
      left =
        align === 'end'
          ? Math.min(Math.max(margin, rect.right - panelWidth), window.innerWidth - panelWidth - margin)
          : Math.min(Math.max(margin, rect.left), window.innerWidth - panelWidth - margin)
      const spaceBelow = window.innerHeight - rect.bottom - margin
      top =
        rawHeight > spaceBelow && rect.top - margin > spaceBelow
          ? Math.max(margin, rect.top - panelHeight - 4)
          : rect.bottom + 4
    }
    const next = {
      top,
      left,
      zIndex: floatingPanelZIndex(),
    }
    setAnchor((prev) =>
      prev && prev.top === next.top && prev.left === next.left && prev.zIndex === next.zIndex
        ? prev
        : next,
    )
  }, [align, anchorRef, placement])

  React.useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onClose?.()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.()
    }
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return
      place()
    }

    place()
    let observer: ResizeObserver | null = null
    const watch = () => {
      place()
      if (typeof ResizeObserver === 'undefined') return
      observer?.disconnect()
      observer = new ResizeObserver(() => place())
      if (anchorRef.current) observer.observe(anchorRef.current)
      if (panelRef.current) observer.observe(panelRef.current)
    }
    const frame = requestAnimationFrame(watch)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open, onClose, place, anchorRef])

  if (!open || !anchor || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      data-slot="portaled-floating-panel"
      data-scroll-isolate={scrollIsolate ? '' : undefined}
      style={{
        position: 'fixed',
        top: anchor.top,
        left: anchor.left,
        zIndex: anchor.zIndex,
        maxHeight: 'calc(100vh - 1rem)',
        overflowY: 'auto',
      }}
      className={cn(className)}
    >
      {children}
    </div>,
    document.body,
  )
}
