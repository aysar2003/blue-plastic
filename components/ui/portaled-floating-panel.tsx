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
 * A fixed panel portaled to `document.body`, anchored under a trigger.
 * Use for menus and column pickers that would otherwise clip under
 * `overflow-hidden` ancestors or paint beneath open dialogs.
 */
export function PortaledFloatingPanel({
  open,
  anchorRef,
  onClose,
  align = 'start',
  className,
  children,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onClose?: () => void
  align?: 'start' | 'end'
  className?: string
  children: React.ReactNode
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = React.useState<Anchor>()

  const place = React.useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    const panelWidth = panelRef.current?.offsetWidth || Math.max(rect.width, 176)
    const left =
      align === 'end'
        ? Math.min(Math.max(8, rect.right - panelWidth), window.innerWidth - panelWidth - 8)
        : Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8)
    const next = {
      top: rect.bottom + 4,
      left,
      zIndex: floatingPanelZIndex(),
    }
    setAnchor((prev) =>
      prev && prev.top === next.top && prev.left === next.left && prev.zIndex === next.zIndex
        ? prev
        : next,
    )
  }, [align, anchorRef])

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
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => {
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
      style={{
        position: 'fixed',
        top: anchor.top,
        left: anchor.left,
        zIndex: anchor.zIndex,
      }}
      className={cn(className)}
    >
      {children}
    </div>,
    document.body,
  )
}
