'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { moduleForPath } from '@/lib/feature-flags'
import { HeaderApps } from './app-launcher'
import { ActiveAppLink, AppsBarToggle, useAppsBarHidden } from './apps-bar'
import { AppMemoryProvider } from './app-memory'
import { AccountantNav } from './accountant-nav'
import { CompanySwitcher, type CompanyOption } from './company-switcher'
import { HistoryBack } from './history-back'
import { ModuleTabs } from './module-tabs'
import { NavTrailRecorder } from './nav-trail-recorder'
import { CommandPalette } from './command-palette'
import { moduleFor } from './nav-items'
import { NavigationProgress } from './navigation-progress'
import { QuickCreate } from './quick-create'
import { ScrollChain } from './scroll-chain'
import { ShellMenus } from './shell-menus'
import { UserMenu } from './user-menu'
import { CompanyLetterhead } from '@/components/print/company-letterhead'
import type { LetterheadSource } from '@/lib/letterhead'
import { orgLogoUrl, resolveBrandMark } from '@/lib/org-brand'
import { PRODUCT_CREDIT, PRODUCT_NAME } from '@/lib/product-brand'

type ShellChromeProps = {
  orgName: string
  organization: LetterheadSource
  /** Explicit mark override from Settings → Organisation. */
  brandMark?: string | null
  hasLogo?: boolean
  logoVersion?: Date | string | number | null
  baseCurrency: string
  fiscalYearStartMonth: number
  roleLabel: string
  user: { id: string; name: string; email: string; image: string | null }
  moduleKeys: string[]
  permissions: string[]
  /** Other companies this user can open. Empty unless they may switch. */
  companies?: CompanyOption[]
  /** System owner may create another company from the switcher. */
  allowCreateCompany?: boolean
  /** Databases app link in the account menu. */
  showDatabases?: boolean
  /** Consolidated company reports in the account menu. */
  showCompanyReports?: boolean
  /** Launcher app keys switched off in Settings → Configuration. */
  hiddenApps?: string[]
  /** Creator credit — off via Settings → Features. */
  showCreatorBrand?: boolean
  /** Streamed server slot; null when the user lacks inventory:read. */
  stockAlertsSlot: React.ReactNode
  /** Streamed server slot; null when the user lacks customer:read. */
  balanceAlertsSlot: React.ReactNode
  /** Streamed server slot; null when the user lacks calendar:read. */
  calendarAlertsSlot?: React.ReactNode
  /** This-month P&L chart; null when the user lacks report:read. */
  monthChartSlot?: React.ReactNode
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

const POS_HUB_SEGMENTS = new Set(['orders', 'quotations', 'sessions', 'settings'])

/** True for `/pos/[registerId]` and its lock/display children — not hub list pages. */
function isPosLiveTill(pathname: string) {
  if (!pathname.startsWith('/pos')) return false
  if (pathname.includes('/lock') || pathname.includes('/display')) return true
  const segments = pathname.split('/').filter(Boolean)
  return (
    segments.length === 2 &&
    segments[0] === 'pos' &&
    !POS_HUB_SEGMENTS.has(segments[1]!)
  )
}

/**
 * One surface for the whole system — the light ground, teal mark and open
 * header that Sales already uses. The header names the module you are in and
 * returns you to its front door.
 */
export function ShellChrome({
  orgName,
  organization,
  brandMark = null,
  hasLogo = false,
  logoVersion = null,
  baseCurrency,
  roleLabel,
  user,
  permissions,
  companies = [],
  allowCreateCompany = false,
  showDatabases = false,
  showCompanyReports = false,
  hiddenApps,
  showCreatorBrand = true,
  stockAlertsSlot,
  balanceAlertsSlot,
  calendarAlertsSlot = null,
  monthChartSlot,
  children,
}: ShellChromeProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { hidden: appsHidden, toggle: toggleAppsBar } = useAppsBarHidden()
  const current = moduleFor(pathname)

  // Soft client guard: URLs for switched-off apps bounce home (layouts also refuse).
  useEffect(() => {
    const flag = moduleForPath(pathname)
    if (flag && hiddenApps?.includes(flag)) {
      router.replace('/dashboard')
    }
  }, [pathname, hiddenApps, router])
  const isHome = !current || current.key === 'dashboard'
  const isPos = pathname === '/pos' || pathname.startsWith('/pos/')
  const isHub = HUB_PATHS.has(pathname)
  // Live till (+ lock/display) owns its chrome; hub pages use the normal Back control.
  const isPosTill = isPosLiveTill(pathname)
  // POS owns its chrome and needs a full-bleed ground (no side padding / atmosphere gaps).
  const fullBleed = isHub || isPos
  // Accounting keeps its side list; Sales (and similar) get a tab strip so
  // Estimates / Invoices stay one click away.
  const showAccountantNav = current?.key === 'accounting' && !pathname.endsWith('/print')
  const showModuleTabs =
    Boolean(current?.tabs?.length) &&
    current?.key === 'sales' &&
    !pathname.endsWith('/print')
  const isPrint = pathname.endsWith('/print')
  const working = !isPrint
  // Print pages still need a way back. Hide Back only on the live till.
  const showBack = pathname !== '/dashboard' && !isPosTill

  const companyMark = resolveBrandMark(brandMark, orgName)
  const logoSrc = orgLogoUrl(hasLogo, logoVersion)
  const brandSubtitle = isHome ? PRODUCT_NAME : current.label
  const brandHref = isHome ? '/dashboard' : current.href

  // clip (not hidden) cuts sideways overflow without becoming a scroll container.
  // hidden would trap sticky column names in a box that grows with the page.
  return (
    <AppMemoryProvider userId={user.id}>
    <div className="app-surface relative flex min-h-svh overflow-x-clip">
      <ScrollChain />
      <NavTrailRecorder />
      <NavigationProgress />
      {isPos ? null : <AppAtmosphere />}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/*
          The three header bars stack above the page and above each other, top
          bar highest, so a menu opened from any of them is never covered by
          the bar below it or by the page's own sticky bars (the POS
          Products / Reporting / Configuration bar is sticky z-20). Page
          content stays at z-20 or below; full-screen overlays (POS payment,
          register lock) sit higher still and keep covering everything.
        */}
        <header className="shell-topbar relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-card/80 px-4 backdrop-blur-md sm:px-6">
          <Link
            href={brandHref}
            className="flex min-w-0 items-center gap-2.5"
            title={`${orgName}. Change logo and mark in Settings → Organisation. ${PRODUCT_CREDIT}`}
          >
            {logoSrc ? (
              <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-background shadow-sm ring-1 ring-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated org logo API */}
                <img src={logoSrc} alt="" className="size-full object-contain p-0.5" />
              </span>
            ) : (
              <span className="shell-brand-mark grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-[0.7rem] font-bold tracking-wide text-primary-foreground shadow-sm">
                {companyMark}
              </span>
            )}
            <span className="min-w-0 leading-tight">
              <span className="shell-brand-label block truncate text-sm font-semibold tracking-tight text-foreground">
                {orgName}
              </span>
              <span className="block truncate text-[0.65rem] leading-tight text-muted-foreground">
                {brandSubtitle}
              </span>
            </span>
          </Link>

          {showDatabases || companies.length > 1 ? (
            <CompanySwitcher
              companies={companies}
              allowCreate={allowCreateCompany}
              allowClose={showDatabases}
            />
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            {working ? (
              <ActiveAppLink
                permissions={permissions}
                hiddenApps={hiddenApps}
                barHidden={appsHidden}
              />
            ) : null}
            {working ? <AppsBarToggle hidden={appsHidden} onToggle={toggleAppsBar} /> : null}
            {working ? (
              <QuickCreate
                permissions={permissions}
                currency={baseCurrency}
                hiddenApps={hiddenApps}
              />
            ) : null}
            {working ? <CommandPalette permissions={permissions} /> : null}
            {working ? <ShellMenus /> : null}
            {stockAlertsSlot}
            {balanceAlertsSlot}
            {calendarAlertsSlot}
            <UserMenu
              user={user}
              roleLabel={roleLabel}
              showDatabases={showDatabases}
              showCompanyReports={showCompanyReports}
            />
          </div>
        </header>

        {working ? (
          <div
            id="app-icon-bar"
            hidden={appsHidden}
            className="shell-apps relative z-30 border-b border-border/70 bg-card/85 px-4 py-1.5 print:hidden sm:px-6"
          >
            {appsHidden ? null : <HeaderApps permissions={permissions} hidden={hiddenApps} />}
          </div>
        ) : null}

        {showAccountantNav ? (
          <div className="shell-tabs relative z-[25] border-b border-primary/15 bg-card/80 print:hidden">
            <AccountantNav permissions={permissions} currency={baseCurrency} />
          </div>
        ) : null}

        {showModuleTabs && current?.tabs ? (
          <div className="shell-tabs relative z-[25] border-b border-border/70 bg-card/90 print:hidden">
            <ModuleTabs tabs={current.tabs} permissions={permissions} />
          </div>
        ) : null}

        {working && !isPosTill ? (
          <div className="relative z-[24] print:hidden">{monthChartSlot}</div>
        ) : null}

        <div className="company-print-letterhead hidden px-6 pt-4 print:block">
          <CompanyLetterhead organization={organization} />
        </div>

        <main
          className={
            fullBleed
              ? 'relative min-w-0 w-full flex-1'
              : 'relative min-w-0 w-full flex-1 px-[clamp(0.75rem,1.6vw,2rem)] py-[clamp(0.75rem,1.4vw,1.5rem)]'
          }
        >
          {showBack ? (
            <div
              className={
                fullBleed && !isPos
                  ? 'px-4 pt-4 print:hidden sm:px-6'
                  : isPos
                    ? 'px-3 pt-3 print:hidden sm:px-6'
                    : 'mb-3 print:hidden'
              }
            >
              <HistoryBack />
            </div>
          ) : null}
          {children}
        </main>

        {!isPrint && !isPos ? (
          <footer className="relative z-10 border-t border-border/60 px-4 py-2 text-center print:hidden sm:px-6">
            <p className="text-[0.6875rem] tracking-wide text-muted-foreground">
              <span className="font-medium text-foreground/80">{PRODUCT_NAME}</span>
              {showCreatorBrand ? (
                <>
                  <span className="mx-1.5 text-muted-foreground/55">·</span>
                  <span>{PRODUCT_CREDIT}</span>
                </>
              ) : null}
            </p>
          </footer>
        ) : null}
      </div>
    </div>
    </AppMemoryProvider>
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
