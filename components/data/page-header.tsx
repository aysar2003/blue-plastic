import type { ReactNode } from 'react'

import {
  ReportSheetHeader,
  type ReportSheetOrganization,
} from '@/components/reports/report-sheet-header'
import { cn } from '@/lib/utils'

/**
 * The strip at the top of every screen: what this is, and what can be done to
 * it. Odoo calls it the control panel and puts it in exactly this place, which
 * is why the primary action is always in the same spot however deep you are.
 *
 * On report sheets, pass `organization` so the company name and report title
 * print and export together as one masthead.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  organization,
}: {
  title: ReactNode
  description?: string
  actions?: ReactNode
  className?: string
  organization?: ReportSheetOrganization
}) {
  if (organization) {
    return (
      <div className={cn('page-header mb-4', className)}>
        <ReportSheetHeader
          organization={organization}
          title={title}
          subtitle={description}
        />
        {actions ? (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 print:hidden">
            {actions}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'page-header mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5 print:hidden">{actions}</div> : null}
    </div>
  )
}
