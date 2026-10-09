import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The columns that do not fit across a laptop, laid out under the row they
 * belong to. They wrap onto as many lines as they need, so the page never
 * grows a horizontal scrollbar to reach them.
 */
export function ColumnBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('grid gap-x-3 gap-y-2', className)}
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 9.25rem), 1fr))' }}
    >
      {children}
    </div>
  )
}

