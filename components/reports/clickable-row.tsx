'use client'

import { useRouter } from 'next/navigation'

import { TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

/**
 * A report line that opens when any part of it is clicked.
 *
 * The name and the amount may still be their own links. A click that is not
 * already on one of those follows the line: the date, the memo, the blank
 * space. That is the same gesture as putting the pointer on the row.
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href?: string
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  if (!href) return <TableRow className={className}>{children}</TableRow>

  return (
    <TableRow
      className={cn('cursor-pointer', className)}
      onClick={(event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (target.closest('a, button, input, select, textarea, summary, details')) return
        router.push(href)
      }}
    >
      {children}
    </TableRow>
  )
}
