import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Table sheet scrollport. Sticky column names pin inside this box.
 * Nested wheel chaining (table → page) is handled app-wide by ScrollChain.
 */
export function TableScrollPort({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="table-container"
      data-table-scroll=""
      className={cn(
        'relative w-full max-w-full sticky top-0 z-20 max-h-dvh overflow-auto overscroll-contain',
        className,
      )}
    >
      {children}
    </div>
  )
}
