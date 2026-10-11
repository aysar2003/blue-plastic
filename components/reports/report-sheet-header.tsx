import type { ReactNode } from 'react'

import { letterheadOf, type LetterheadSource } from '@/lib/letterhead'
import { orgLogoUrl, resolveBrandMark } from '@/lib/org-brand'
import { cn } from '@/lib/utils'

export type ReportSheetOrganization = LetterheadSource & {
  brandMark?: string | null
  hasLogo?: boolean
  updatedAt?: Date | string | null
}

/**
 * Company name + report title + period — the masthead on every report sheet
 * (screen, print, and the same wording exports carry).
 */
export function ReportSheetHeader({
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
  const block = letterheadOf(organization)
  const mark = resolveBrandMark(organization.brandMark, block.name)
  const logoSrc = orgLogoUrl(Boolean(organization.hasLogo), organization.updatedAt)

  return (
    <header className={cn('report-sheet-header', className)} data-report-sheet-header>
      <div className="report-sheet-header__brand">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- auth-gated org logo API
          <img src={logoSrc} alt="" className="report-sheet-header__logo" />
        ) : (
          <span className="report-sheet-header__mark" aria-hidden>
            {mark}
          </span>
        )}
        <div className="report-sheet-header__names">
          <p className="report-sheet-header__company">{block.name}</p>
          {title ? <h1 className="report-sheet-header__title">{title}</h1> : null}
          {subtitle ? <p className="report-sheet-header__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {(block.address || block.phone || block.email) && (
        <p className="report-sheet-header__contact">
          {[block.address, block.phone ? `Phone ${block.phone}` : null, block.email ? `Email ${block.email}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </header>
  )
}
