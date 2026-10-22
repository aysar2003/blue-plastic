'use client'

import { useState } from 'react'
import { Columns3Icon, GripVerticalIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ColumnPrefs } from '@/lib/table-column-prefs'
import { cn } from '@/lib/utils'

export type CustomizeColumn = { id: string; label: string }

export function TableColumnCustomize({
  columns,
  prefs,
  onToggle,
  onReorder,
  className,
  title = 'Customize',
  description = 'Drag to change column order. Check columns you want to see.',
  showAllLabel = 'Show all columns',
}: {
  columns: CustomizeColumn[]
  prefs: ColumnPrefs
  onToggle: (id: string) => void
  onReorder: (from: string, to: string) => void
  className?: string
  title?: string
  description?: string
  showAllLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const list = prefs.order
    .map((id) => columns.find((c) => c.id === id))
    .filter((c): c is CustomizeColumn => Boolean(c))

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('print:hidden', className)}
        onClick={() => setOpen(true)}
      >
        <Columns3Icon className="size-4" />
        Customize
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="sm"
          className={cn(
            // The shared dialog centers itself with sm:-translate-y-1/2. A plain
            // translate-y-0 does not cancel that breakpoint, so the title slides
            // off the top of the screen. Pin it under the shell on every page.
            'left-auto right-3 top-28 flex w-full max-w-md translate-x-0 translate-y-0 flex-col overflow-hidden rounded-lg border shadow-xl',
            'max-h-[calc(100svh-8rem)] sm:left-auto sm:right-4 sm:top-32 sm:max-h-[calc(100svh-9rem)] sm:translate-x-0 sm:translate-y-0',
            'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          )}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="mb-3 flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                for (const col of list) {
                  if (prefs.hidden.includes(col.id)) onToggle(col.id)
                }
              }}
            >
              {showAllLabel}
            </Button>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {list.map((col) => {
              const checked = !prefs.hidden.includes(col.id)
              return (
                <li
                  key={col.id}
                  draggable
                  onDragStart={() => setDragId(col.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) onReorder(dragId, col.id)
                    setDragId(null)
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border bg-background px-2 py-2',
                    dragId === col.id && 'opacity-60',
                  )}
                >
                  <GripVerticalIcon className="size-4 shrink-0 cursor-grab text-foreground/75" aria-hidden />
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(col.id)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
