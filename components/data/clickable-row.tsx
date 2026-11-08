'use client'

import { useRouter } from 'next/navigation'

import { TableRow } from '@/components/ui/table'
import { captureFromRow, currentListHref, writeListReturn } from '@/lib/list-return'
import { cn } from '@/lib/utils'

/**
 * A list or report line that opens when any part of it is clicked.
 *
 * Nested links, buttons, checkboxes, and menus keep their own jobs. A click
 * on the rest of the row follows `href` — the same gesture as putting the
 * pointer on the line.
 */
export function ClickableRow({
  href,
  rowId,
  className,
  title,
  band,
  children,
}: {
  href?: string
  /** Stable id for Back-return markers; defaults to `href`. */
  rowId?: string
  className?: string
  title?: string
  /** A second line of the same record. Arrow keys stay on the main row. */
  band?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const id = rowId ?? href
  if (!href) {
    return (
      <TableRow
        className={className}
        data-row-id={id}
        data-column-band={band ? '' : undefined}
      >
        {children}
      </TableRow>
    )
  }

  return (
    <TableRow
      title={title}
      data-row-id={id}
      data-column-band={band ? '' : undefined}
      className={cn('cursor-pointer hover:bg-muted/50', className)}
      onClick={(event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (target.closest('a, button, input, select, textarea, summary, details, label')) return
        const saved = captureFromRow(event.currentTarget, {
          listHref: currentListHref(),
          linkHref: href,
        })
        if (saved) writeListReturn(saved)
        router.push(href)
      }}
    >
      {children}
    </TableRow>
  )
}
