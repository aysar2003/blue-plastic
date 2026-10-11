import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Marks a list page sheet. Scrolling and sticky column names live on the
 * `Table` inside (`data-table-scroll`) — this wrapper only keeps call sites
 * tidy and must not become a second scrollport.
 */
export function ScrollSheet({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  if (!className) return children
  return <div className={cn(className)}>{children}</div>
}
