import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A data sheet that shows every row. The list scrolls instead of paging.
 */
export function ScrollSheet({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('max-h-[70vh] overflow-auto', className)}>{children}</div>
}
