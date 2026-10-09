import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A data sheet that shows every row. The list scrolls instead of paging, and
 * the table header stays pinned at the top of this pane.
 */
export function ScrollSheet({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('max-h-[min(70vh,42rem)] overflow-x-clip overflow-y-auto overscroll-contain', className)}>
      {children}
    </div>
  )
}
