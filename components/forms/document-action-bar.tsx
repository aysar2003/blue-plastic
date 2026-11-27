import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Footer strip for create/edit sales & purchase documents.
 * Under Appearance → Odoo it becomes a control-panel bar with a status chip;
 * other themes keep a plain right-aligned button row.
 */
export function DocumentActionBar({
  status = 'Draft',
  statusTone = 'draft',
  children,
  className,
}: {
  /** Shown in the Odoo control-panel status chip (left). */
  status?: string
  statusTone?: 'draft' | 'open' | 'void' | 'neutral'
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('document-action-bar print:hidden', className)}
      data-status-tone={statusTone}
    >
      <span className="document-action-bar-status" data-tone={statusTone}>
        {status}
      </span>
      <div className="document-action-bar-actions">{children}</div>
    </div>
  )
}
