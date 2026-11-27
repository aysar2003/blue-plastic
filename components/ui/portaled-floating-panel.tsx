'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'

import { floatingPanelZIndex } from '@/lib/dialog-stack'
import { cn } from '@/lib/utils'

type Anchor = {
  top: number
  left: number
  zIndex: number
  /** Cap width so a right-side flyout never slides back over the rail. */
  maxWidth?: number
  /** Explicit height so inner lists can flex-scroll without clipping off-screen. */
  height?: number
  maxHeight?: number
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
  /** After the pointer leaves the trigger and panel, close once this many ms pass with no return. */
  closeOnPointerLeaveDelayMs,
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
  closeOnPointerLeaveDelayMs?: number
  className?: string
  children: React.ReactNode
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const measuringRef = React.useRef(false)
  const [anchor, setAnchor] = React.useState<Anchor>()

  const clearLeaveTimer = React.useCallback(() => {
    if (leaveTimerRef.current == null) return
    clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = null
  }, [])

  const scheduleLeaveClose = React.useCallback(() => {
    if (!onClose || closeOnPointerLeaveDelayMs == null || closeOnPointerLeaveDelayMs < 0) return
    clearLeaveTimer()
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null
      onClose()
    }, closeOnPointerLeaveDelayMs)
  }, [clearLeaveTimer, closeOnPointerLeaveDelayMs, onClose])

  const isInsideHoverZone = React.useCallback(
    (node: EventTarget | null) => {
      if (!(node instanceof Node)) return false
      return !!(panelRef.current?.contains(node) || anchorRef.current?.contains(node))
    },
    [anchorRef],
  )

  const onHoverZoneEnter = React.useCallback(() => {
    clearLeaveTimer()
  }, [clearLeaveTimer])

  const onHoverZoneLeave = React.useCallback(
    (event: React.PointerEvent | PointerEvent) => {
      if (isInsideHoverZone(event.relatedTarget)) return
      scheduleLeaveClose()
    },
    [isInsideHoverZone, scheduleLeaveClose],
  )

  const measureContentHeight = React.useCallback(() => {
    const panel = panelRef.current
    if (!panel) return 240
    measuringRef.current = true
    const prevH = panel.style.height
    const prevMax = panel.style.maxHeight
    panel.style.height = 'auto'
    panel.style.maxHeight = 'none'
    const h = Math.max(panel.scrollHeight, panel.offsetHeight, 120)
    panel.style.height = prevH
    panel.style.maxHeight = prevMax
    // Let layout settle before ResizeObserver may fire again.
    queueMicrotask(() => {
      measuringRef.current = false
    })
    return h
  }, [])

  const place = React.useCallback(() => {
    if (measuringRef.current) return
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = 8
    const panel = panelRef.current
    const panelWidth = panel?.offsetWidth || Math.max(rect.width, 176)
    const rawHeight = measureContentHeight()
    const availableH = Math.max(120, window.innerHeight - margin * 2)
    let left: number
    let top: number
    let maxWidth: number | undefined
    let maxHeight = availableH

    if (placement === 'right') {
      // Sit clear of the whole side rail so Settings/Help never cover labels.
      const rail = document.getElementById('app-side-rail')
      const railRight = rail?.getBoundingClientRect().right ?? rect.right
      const openAt = Math.max(rect.right, railRight) + 8
      left = Math.max(margin, openAt)
      maxWidth = Math.max(160, window.innerWidth - left - margin)

      // Fit entirely in the viewport — shift up when the trigger is low so the
      // bottom of a long Settings list is never chopped off-screen.
      const desiredH = Math.min(rawHeight, availableH)
      top = rect.top
      if (top + desiredH > window.innerHeight - margin) {
        top = window.innerHeight - margin - desiredH
      }
      top = Math.max(margin, top)
      maxHeight = Math.max(120, window.innerHeight - top - margin)
    } else {
      left =
        align === 'end'
          ? Math.min(Math.max(margin, rect.right - panelWidth), window.innerWidth - panelWidth - margin)
          : Math.min(Math.max(margin, rect.left), window.innerWidth - panelWidth - margin)
      const spaceBelow = window.innerHeight - rect.bottom - margin
      const panelHeight = Math.min(rawHeight, availableH)
      top =
        rawHeight > spaceBelow && rect.top - margin > spaceBelow
          ? Math.max(margin, rect.top - panelHeight - 4)
          : rect.bottom + 4
      maxHeight = Math.max(120, window.innerHeight - top - margin)
    }

    const height = rawHeight > maxHeight ? maxHeight : undefined
    const next = {
      top,
      left,
      zIndex: floatingPanelZIndex(),
      maxWidth,
      height,
      maxHeight,
    }
    setAnchor((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.zIndex === next.zIndex &&
      prev.maxWidth === next.maxWidth &&
      prev.height === next.height &&
      prev.maxHeight === next.maxHeight
        ? prev
        : next,
    )
  }, [align, anchorRef, measureContentHeight, placement])

  React.useEffect(() => {
    if (!open) {
      clearLeaveTimer()
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      clearLeaveTimer()
      onClose?.()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearLeaveTimer()
        onClose?.()
      }
    }
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return
      place()
    }

    place()
    let observer: ResizeObserver | null = null
    const rail = document.getElementById('app-side-rail')
    const watch = () => {
      place()
      if (typeof ResizeObserver === 'undefined') return
      observer?.disconnect()
      observer = new ResizeObserver(() => {
        if (measuringRef.current) return
        place()
      })
      if (anchorRef.current) observer.observe(anchorRef.current)
      if (panelRef.current) observer.observe(panelRef.current)
      if (rail) observer.observe(rail)
    }
    const frame = requestAnimationFrame(watch)
    const followUp = window.setTimeout(place, 220)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(followUp)
      observer?.disconnect()
      clearLeaveTimer()
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open, onClose, place, anchorRef, clearLeaveTimer])

  // Trigger lives outside the portaled panel — watch it so moving between the
  // two does not start (or keeps cancelling) the leave-to-close timer.
  React.useEffect(() => {
    if (!open || closeOnPointerLeaveDelayMs == null) return
    const trigger = anchorRef.current
    if (!trigger) return
    const onEnter = () => onHoverZoneEnter()
    const onLeave = (event: PointerEvent) => onHoverZoneLeave(event)
    trigger.addEventListener('pointerenter', onEnter)
    trigger.addEventListener('pointerleave', onLeave)
    return () => {
      trigger.removeEventListener('pointerenter', onEnter)
      trigger.removeEventListener('pointerleave', onLeave)
    }
  }, [open, closeOnPointerLeaveDelayMs, anchorRef, onHoverZoneEnter, onHoverZoneLeave])

  if (!open || !anchor || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      data-slot="portaled-floating-panel"
      data-scroll-isolate={scrollIsolate ? '' : undefined}
      onPointerEnter={closeOnPointerLeaveDelayMs != null ? onHoverZoneEnter : undefined}
      onPointerLeave={closeOnPointerLeaveDelayMs != null ? onHoverZoneLeave : undefined}
      style={{
        position: 'fixed',
        top: anchor.top,
        left: anchor.left,
        zIndex: anchor.zIndex,
        maxWidth: anchor.maxWidth,
        height: anchor.height,
        maxHeight: anchor.maxHeight ?? 'calc(100vh - 1rem)',
        overflow: 'hidden',
      }}
      className={cn('flex flex-col', className)}
    >
      {children}
    </div>,
    document.body,
  )
}
