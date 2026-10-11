import type { ReactNode } from 'react'

import { ReportSheetHeader, type ReportSheetOrganization } from '@/components/reports/report-sheet-header'
import { cn } from '@/lib/utils'

/** Company name, address, phone, and email. Prints with the page. */
export function CompanyLetterhead({
  organization,
  title,
  subtitle,
  className,
}: {
  organization: ReportSheetOrganization
  title?: ReactNode
  subtitle?: string | null
  className?: string
}) {
  return (
    <ReportSheetHeader
      organization={organization}
      title={title}
      subtitle={subtitle}
      className={cn(className)}
    />
  )
}
