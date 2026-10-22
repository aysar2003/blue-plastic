'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { registerDialogCloser } from '@/lib/dialog-stack'
import { cn } from '@/lib/utils'

/**
 * The dialog every modal in the application uses.
 *
 * Built on Radix rather than on a `fixed inset-0` div, which is what nine
 * screens were each doing separately. The difference is not appearance: it is
 * the focus trap, the return of focus to whatever opened it, Escape, the scroll
 * lock, the portal, and the aria wiring. Those are the parts that are tedious to
 * write once and never written correctly nine times.
 *
 * Successive dialogs (a second window opened while another is open) stack above
 * the first via a process-wide layer counter — standard nested-modal behaviour.
 *
 * Each dialog can be dragged by its header and resized from the bottom-right
 * corner, so the page underneath stays usable while the form is open.
 */
const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

let dialogLayer = 0

function useDialogLayer(open: boolean | undefined) {
  const [layer, setLayer] = React.useState(0)
  React.useEffect(() => {
    if (open === false) return
    dialogLayer += 1
    const current = dialogLayer
    // Nested dialogs need a mount-time layer; defer so render is not cascading.
    queueMicrotask(() => setLayer(current))
    return () => {
      dialogLayer = Math.max(0, dialogLayer - 1)
    }
  }, [open])
  return layer
}

function DialogOverlay({
  className,
  style,
  layer = 0,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & { layer?: number }) {
  const z = 50 + layer * 10
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      style={{ ...style, zIndex: z }}
      className={cn(
        // Pass clicks through so the page under a moved dialog stays usable.
        'pointer-events-none fixed inset-0 bg-black/25 backdrop-blur-[0.5px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  )
}

const SIZE_MIN = { w: 280, h: 160 }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function DialogContent({
  className,
  children,
  size = 'md',
  style,
  onPointerDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const width = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  }[size]
  // Radix Content has data-state; treat mount as open for stacking.
  const layer = useDialogLayer(true)
  const z = 51 + layer * 10
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [offset, setOffset] = React.useState<{ x: number; y: number } | null>(null)
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null)

  // Shell Back closes this form first and reveals the page / dialog under it.
  React.useEffect(() => {
    return registerDialogCloser(() => {
      closeRef.current?.click()
    })
  }, [])

  const beginDrag = (event: React.PointerEvent, from: 'header' | 'grip') => {
    if (event.button !== 0 || !panelRef.current) return
    const target = event.target as HTMLElement
    // Inputs, buttons, and the close control stay interactive — not a drag.
    if (
      from === 'header' &&
      target.closest('button, a, input, textarea, select, [role="combobox"], [data-no-drag]')
    ) {
      return
    }
    if (from === 'header' && !target.closest('[data-slot="dialog-header"]')) return

    event.preventDefault()
    const rect = panelRef.current.getBoundingClientRect()
    const origin = offset ?? { x: rect.left, y: rect.top }
    // First drag: pin the current on-screen position (drops centering transform).
    if (!offset) setOffset({ x: rect.left, y: rect.top })

    const startX = event.clientX
    const startY = event.clientY
    const startLeft = origin.x
    const startTop = origin.y

    const onMove = (move: PointerEvent) => {
      const maxX = window.innerWidth - 80
      const maxY = window.innerHeight - 48
      setOffset({
        x: clamp(startLeft + (move.clientX - startX), -rect.width + 80, maxX),
        y: clamp(startTop + (move.clientY - startY), 0, maxY),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (event: React.PointerEvent) => {
    if (event.button !== 0 || !panelRef.current) return
    event.preventDefault()
    event.stopPropagation()

    const rect = panelRef.current.getBoundingClientRect()
    if (!offset) setOffset({ x: rect.left, y: rect.top })
    if (!box) setBox({ w: rect.width, h: rect.height })

    const startX = event.clientX
    const startY = event.clientY
    const startW = box?.w ?? rect.width
    const startH = box?.h ?? rect.height

    const onMove = (move: PointerEvent) => {
      const maxW = window.innerWidth - (offset?.x ?? rect.left) - 8
      const maxH = window.innerHeight - (offset?.y ?? rect.top) - 8
      setBox({
        w: clamp(startW + (move.clientX - startX), SIZE_MIN.w, Math.max(SIZE_MIN.w, maxW)),
        h: clamp(startH + (move.clientY - startY), SIZE_MIN.h, Math.max(SIZE_MIN.h, maxH)),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay layer={layer} />
      <DialogPrimitive.Content
        ref={panelRef}
        data-slot="dialog-content"
        style={{
          ...style,
          zIndex: z,
          ...(offset
            ? {
                left: offset.x,
                top: offset.y,
                transform: 'none',
                right: 'auto',
                bottom: 'auto',
              }
            : {}),
          ...(box
            ? {
                width: box.w,
                height: box.h,
                maxWidth: 'none',
                maxHeight: 'none',
              }
            : {}),
        }}
        className={cn(
          'pointer-events-auto fixed left-1/2 top-4 w-[calc(100%-2rem)] -translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2',
          // A tall form scrolls inside the dialog rather than pushing the page,
          // so the header and the footer buttons stay where the user left them.
          'max-h-[calc(100svh-2rem)] overflow-y-auto rounded-md border bg-card p-5 text-card-foreground shadow-xl',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          width,
          className,
        )}
        onPointerDown={(event) => {
          beginDrag(event, 'header')
          onPointerDown?.(event)
        }}
        // Keep the dialog open when the user clicks the page underneath.
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        {...props}
      >
        <div
          data-dialog-drag-grip=""
          data-no-drag=""
          role="presentation"
          title="Drag to move"
          className="absolute left-1/2 top-1.5 z-10 h-1.5 w-10 -translate-x-1/2 cursor-grab rounded-full bg-muted-foreground/35 active:cursor-grabbing"
          onPointerDown={(event) => beginDrag(event, 'grip')}
        />
        {children}
        <DialogPrimitive.Close
          ref={closeRef}
          data-dialog-close=""
          data-no-drag=""
          className={cn(
            'absolute right-4 top-4 rounded-sm text-muted-foreground opacity-70 transition-opacity',
            'hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
          )}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
        <button
          type="button"
          data-no-drag=""
          aria-label="Resize dialog"
          className={cn(
            'absolute bottom-0 right-0 z-10 size-4 cursor-se-resize rounded-br-md',
            'border-b-2 border-r-2 border-muted-foreground/40',
            'hover:border-muted-foreground',
          )}
          onPointerDown={startResize}
        />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('mb-4 cursor-grab space-y-1 pr-8 active:cursor-grabbing', className)}
      title="Drag to move"
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-base font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
}
