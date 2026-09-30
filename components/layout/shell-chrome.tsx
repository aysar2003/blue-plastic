'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGridIcon } from 'lucide-react'

import { MONTHS } from '@/lib/constants'
import { CommandPalette } from './command-palette'
import { MobileNav } from './mobile-nav'
import { NavigationProgress } from './navigation-progress'
import { QuickCreate } from './quick-create'
import { SidebarNav } from './sidebar-nav'
import { UserMenu } from './user-menu'

type ShellChromeProps = {
  orgName: string
  baseCurrency: string
  fiscalYearStartMonth: number
  roleLabel: string
  user: { id: string; name: string; email: string; image: string | null }
  moduleKeys: string[]
  permissions: string[]
  children: React.ReactNode
}

/**
 * Home + Sales share one light surface. Other modules keep the dense sidebar.
 */
export function ShellChrome({
  orgName,
  baseCurrency,
  fiscalYearStartMonth,
  roleLabel,
  user,
  moduleKeys,
  permissions,
  children,
}: ShellChromeProps) {
  const pathname = usePathname()
  const isAppsHome = pathname === '/dashboard'
  const isSalesHub = pathname === '/sales' || pathname === '/sales/reports'
  const isSalesWorkspace = isSalesWorkspacePath(pathname)

  if (isAppsHome || isSalesHub || isSalesWorkspace) {
    const brandLabel = isAppsHome ? orgName : 'Sales'
    const brandHref = isAppsHome ? '/dashboard' : '/sales'

    return (
      <div className="sales-surface relative flex min-h-svh flex-col overflow-x-hidden">
        <NavigationProgress />
        <SalesAtmosphere />

        <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-md sm:px-6">
          <Link href={brandHref} className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#0B4F6C] text-[0.7rem] font-bold tracking-wide text-white shadow-sm">
              BP
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-slate-800">
              {brandLabel}
            </span>
          </Link>

          {!isAppsHome ? (
            <Link
              href="/dashboard"
              className="hidden text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 sm:inline"
            >
              All apps
            </Link>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            {isAppsHome || isSalesHub ? (
              <>
                <QuickCreate permissions={permissions} currency={baseCurrency} />
                <CommandPalette permissions={permissions} />
              </>
            ) : null}
            <UserMenu user={user} roleLabel={roleLabel} />
          </div>
        </header>

        <main
          className={
            isSalesWorkspace
              ? 'relative z-10 mx-auto min-w-0 w-full max-w-6xl flex-1 px-3 py-5 sm:px-5 lg:px-6'
              : 'relative z-10 min-w-0 flex-1'
          }
        >
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh">
      <NavigationProgress />

      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded bg-primary text-[0.625rem] font-bold text-primary-foreground">
              <LayoutGridIcon className="size-3.5" aria-hidden />
            </span>
            <span className="truncate text-[0.8125rem] font-semibold">{orgName}</span>
          </Link>
        </div>

        <SidebarNav allowed={moduleKeys} permissions={permissions} />

        <div className="shrink-0 border-t px-3 py-2.5 text-[0.6875rem] text-muted-foreground">
          Books in <span className="font-medium text-foreground/80">{baseCurrency}</span>
          <span aria-hidden> · </span>
          FY starts {MONTHS[fiscalYearStartMonth - 1]}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3 sm:px-4">
          <MobileNav allowed={moduleKeys} permissions={permissions} orgName={orgName} />
          <span className="truncate text-[0.8125rem] font-semibold lg:hidden">{orgName}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <QuickCreate permissions={permissions} currency={baseCurrency} />
            <CommandPalette permissions={permissions} />
            <UserMenu user={user} roleLabel={roleLabel} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 lg:px-6">{children}</main>
      </div>
    </div>
  )
}

function isSalesWorkspacePath(pathname: string): boolean {
  if (pathname === '/sales' || pathname === '/sales/reports') return false
  return (
    pathname.startsWith('/sales/') ||
    pathname === '/payments' ||
    pathname.startsWith('/payments/') ||
    pathname === '/customers' ||
    pathname.startsWith('/customers/')
  )
}

function SalesAtmosphere() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] max-h-[28rem]"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(56, 152, 196, 0.28) 0%, rgba(244, 247, 251, 0) 62%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-24 size-72 rounded-full opacity-40 blur-3xl"
        style={{ background: 'rgba(14, 116, 144, 0.12)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-40 size-64 rounded-full opacity-50 blur-3xl"
        style={{ background: 'rgba(15, 118, 110, 0.1)' }}
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 w-full text-sky-400/25"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
      >
        <path
          fill="currentColor"
          d="M0,64 C240,140 480,160 720,120 C960,80 1200,20 1440,48 L1440,0 L0,0 Z"
        />
      </svg>
    </>
  )
}
