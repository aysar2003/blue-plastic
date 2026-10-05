'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { HeaderApps } from './app-launcher'
import { AccountantNav } from './accountant-nav'
import { HistoryBack } from './history-back'
import { CommandPalette } from './command-palette'
import { moduleFor } from './nav-items'
import { NavigationProgress } from './navigation-progress'
import { QuickCreate } from './quick-create'
import { ShellMenus } from './shell-menus'
import { UserMenu } from './user-menu'
import { CompanyLetterhead } from '@/components/print/company-letterhead'
import type { LetterheadSource } from '@/lib/letterhead'

type ShellChromeProps = {
  orgName: string
  organization: LetterheadSource
  baseCurrency: string
  fiscalYearStartMonth: number
  roleLabel: string
  user: { id: string; name: string; email: string; image: string | null }
  moduleKeys: string[]
  permissions: string[]
  /** Streamed server slot; null when the user lacks inventory:read. */
  stockAlertsSlot: React.ReactNode
  /** Streamed server slot; null when the user lacks customer:read. */
  balanceAlertsSlot: React.ReactNode
  children: React.ReactNode
}

/**
 * Exact paths that are launchers rather than a working screen.
 * A module home, and any "reports" door inside a module, uses the open grid.
 * Everything else is a workspace: same colour, narrower column.
 */
const HUB_PATHS = new Set([
  '/dashboard',
  '/sales',
  '/sales/reports',
  '/purchases',
  '/purchases/reports',
  '/banking',
  '/inventory',
  '/inventory/reports',
  '/accounting',
  '/accounting/reports',
  '/reports',
  '/settings',
  '/help',
])

/**
 * One surface for the whole system — the light ground, teal mark and open
 * header that Sales already uses. The header names the module you are in and
 * returns you to its front door.
 */
export function ShellChrome({
  orgName,
  organization,
  baseCurrency,
  roleLabel,
  user,
  permissions,
  stockAlertsSlot,
  balanceAlertsSlot,
  children,
}: ShellChromeProps) {
  const pathname = usePathname()
  const current = moduleFor(pathname)
  const isHome = !current || current.key === 'dashboard'
  const isHub = HUB_PATHS.has(pathname)
  // The left list belongs to the Accounting app only. Sales, reports, and the
  // other apps keep the header they had before.
  const showNav = current?.key === 'accounting' && !pathname.endsWith('/print')
  const isPrint = pathname.endsWith('/print')
  const working = !isPrint
  // Print pages still need a way back to the document.
  const showBack = pathname !== '/dashboard'

  const brandLabel = isHome ? orgName : current.label
  const brandHref = isHome ? '/dashboard' : current.href

  return (
    <div className="app-surface relative flex min-h-svh overflow-x-hidden">
      <NavigationProgress />
      <AppAtmosphere />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-card/80 px-4 backdrop-blur-md sm:px-6">
          <Link href={brandHref} className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-[0.7rem] font-bold tracking-wide text-primary-foreground shadow-sm">
              BP
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              {brandLabel}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            {working ? <QuickCreate permissions={permissions} currency={baseCurrency} /> : null}
            {working ? <CommandPalette permissions={permissions} /> : null}
            {working ? <ShellMenus /> : null}
            {stockAlertsSlot}
            {balanceAlertsSlot}
            <UserMenu user={user} roleLabel={roleLabel} />
          </div>
        </header>

        {working ? (
          <div className="relative z-20 border-b border-border/70 bg-card/85 px-4 py-1.5 print:hidden sm:px-6">
            <HeaderApps permissions={permissions} />
          </div>
        ) : null}

        {showNav ? (
          <div className="relative z-20 border-b border-primary/15 bg-card/80 print:hidden">
            <AccountantNav permissions={permissions} currency={baseCurrency} />
          </div>
        ) : null}

        <div className="company-print-letterhead hidden px-6 pt-4 print:block">
          <CompanyLetterhead organization={organization} />
        </div>

        <main
          className={
            isHub
              ? 'relative min-w-0 w-full flex-1'
              : 'relative min-w-0 w-full flex-1 px-[clamp(0.75rem,1.6vw,2rem)] py-[clamp(0.75rem,1.4vw,1.5rem)]'
          }
        >
          {showBack ? (
            <div className={isHub ? 'px-4 pt-4 print:hidden sm:px-6' : 'mb-3 print:hidden'}>
              <HistoryBack />
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}

function AppAtmosphere() {
  return (
    <div className="app-atmosphere pointer-events-none" aria-hidden>
      <div className="app-atmosphere-wash pointer-events-none absolute inset-x-0 top-0 h-[42vh] max-h-[28rem]" />
      <div className="app-atmosphere-blob pointer-events-none absolute -left-24 top-24 size-72 rounded-full opacity-40 blur-3xl" />
      <div className="app-atmosphere-blob pointer-events-none absolute -right-16 top-40 size-64 rounded-full opacity-50 blur-3xl" />
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-48 w-full text-primary/25"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
      >
        <path
          fill="currentColor"
          d="M0,64 C240,140 480,160 720,120 C960,80 1200,20 1440,48 L1440,0 L0,0 Z"
        />
      </svg>
    </div>
  )
}
