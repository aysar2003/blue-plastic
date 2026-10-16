'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

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
    setLayer(current)
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
        'fixed inset-0 bg-black/45 backdrop-blur-[1px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  size = 'md',
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

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay layer={layer} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        style={{ zIndex: z }}
        className={cn(
          'fixed left-1/2 top-4 w-[calc(100%-2rem)] -translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2',
          // A tall form scrolls inside the dialog rather than pushing the page,
          // so the header and the footer buttons stay where the user left them.
          'max-h-[calc(100svh-2rem)] overflow-y-auto rounded-md border bg-card p-5 text-card-foreground shadow-xl',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          width,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4 rounded-sm text-muted-foreground opacity-70 transition-opacity',
            'hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
          )}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('mb-4 space-y-1 pr-8', className)} {...props} />
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
