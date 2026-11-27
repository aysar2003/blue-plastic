'use client'

import { usePathname } from 'next/navigation'

import { PlatformConsoleChrome } from '@/components/layout/platform-console-chrome'
import { ShellChrome } from '@/components/layout/shell-chrome'
import { PresenceHeartbeat } from '@/components/presence/presence-heartbeat'
import { IdleLock } from '@/components/security/idle-lock'
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
  fiscalYearStartDay?: number
  idleLockSeconds?: number
  sessionMaxHours?: number
  roleLabel: string
  user: {
    id: string
    name: string
    email: string
    image: string | null
    loginAt?: number | null
    hasDeskPin?: boolean
  }
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

  const userLabel = props.user.email || props.user.name || 'this account'
  const lock = (
    <IdleLock
      orgName={props.orgName}
      userLabel={userLabel}
      hasDeskPin={Boolean(props.user.hasDeskPin)}
      idleLockSeconds={props.idleLockSeconds}
      sessionMaxHours={props.sessionMaxHours}
      loginAt={props.user.loginAt}
    />
  )

  if (isSystemOwner && onPlatformRoutes) {
    return (
      <>
        <PresenceHeartbeat />
        <PlatformConsoleChrome
          user={props.user}
          roleLabel={props.roleLabel}
          showCompanyReports={props.showCompanyReports}
          showCreatorBrand={props.showCreatorBrand}
          currentCompanyName={props.orgName}
        >
          {props.children}
        </PlatformConsoleChrome>
        {lock}
      </>
    )
  }

  return (
    <>
      <PresenceHeartbeat />
      <ShellChrome {...props} />
      {lock}
    </>
  )
}
