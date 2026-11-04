'use client'

import { usePathname } from 'next/navigation'

import { PlatformConsoleChrome } from '@/components/layout/platform-console-chrome'
import { ShellChrome } from '@/components/layout/shell-chrome'
import type { OrgFeatureFlags } from '@/lib/feature-flags'
import type { LetterheadSource } from '@/lib/letterhead'
import type { CompanyOption } from '@/components/layout/company-switcher'

type SharedShellProps = {
  orgName: string
  organization: LetterheadSource
  brandMark?: string | null
  hasLogo?: boolean
  logoVersion?: Date | string | number | null
  baseCurrency: string
  fiscalYearStartMonth: number
  roleLabel: string
  user: { id: string; name: string; email: string; image: string | null }
  moduleKeys: string[]
  permissions: string[]
  companies?: CompanyOption[]
  allowCreateCompany?: boolean
  showDatabases?: boolean
  showCompanyReports?: boolean
  hiddenApps?: string[]
  features?: OrgFeatureFlags
  showCreatorBrand?: boolean
  stockAlertsSlot: React.ReactNode
  balanceAlertsSlot: React.ReactNode
  calendarAlertsSlot?: React.ReactNode
  monthChartSlot?: React.ReactNode
  children: React.ReactNode
}

/**
 * System owners on /databases* get the Platform Console chrome.
 * Everywhere else (including when the owner opens company books) keeps ShellChrome.
 */
export function ShellGate({
  isSystemOwner,
  ...props
}: SharedShellProps & { isSystemOwner: boolean }) {
  const pathname = usePathname()
  const onPlatformRoutes = pathname === '/databases' || pathname.startsWith('/databases/')

  if (isSystemOwner && onPlatformRoutes) {
    return (
      <PlatformConsoleChrome
        user={props.user}
        roleLabel={props.roleLabel}
        showCompanyReports={props.showCompanyReports}
        showCreatorBrand={props.showCreatorBrand}
        currentCompanyName={props.orgName}
      >
        {props.children}
      </PlatformConsoleChrome>
    )
  }

  return <ShellChrome {...props} />
}
