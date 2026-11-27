'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ActivityIcon,
  Building2Icon,
  CreditCardIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  UsersIcon,
} from 'lucide-react'

import { UserMenu } from '@/components/layout/user-menu'
import { NavigationProgress } from '@/components/layout/navigation-progress'
import { PRODUCT_CREDIT, PRODUCT_NAME } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

const NAV = [
  {
    href: '/databases',
    label: 'Console',
    hint: 'Companies & requests',
    icon: LayoutDashboardIcon,
    match: (path: string) =>
      path === '/databases' ||
      (path.startsWith('/databases/') &&
        !path.startsWith('/databases/users') &&
        !path.startsWith('/databases/billing') &&
        !path.startsWith('/databases/apps') &&
        !path.startsWith('/databases/activity')),
  },
  {
    href: '/databases/activity',
    label: 'Activity',
    hint: 'Usage & user motion',
    icon: ActivityIcon,
    match: (path: string) => path.startsWith('/databases/activity'),
  },
  {
    href: '/databases/apps',
    label: 'Apps',
    hint: 'Catalog & grants',
    icon: LayoutGridIcon,
    match: (path: string) => path.startsWith('/databases/apps'),
  },
  {
    href: '/databases/users',
    label: 'System users',
    hint: 'Staff logins',
    icon: UsersIcon,
    match: (path: string) => path.startsWith('/databases/users'),
  },
  {
    href: '/databases/billing',
    label: 'Platform billing',
    hint: 'Plans & rent',
    icon: CreditCardIcon,
    match: (path: string) => path.startsWith('/databases/billing'),
  },
] as const

/**
 * System-owner control plane for /databases — distinct from the company ERP desk.
 * Modern luxury chrome: espresso ink + champagne accents (no neon indigo).
 */
export function PlatformConsoleChrome({
  user,
  roleLabel,
  showCompanyReports = false,
  showCreatorBrand = true,
  currentCompanyName,
  children,
}: {
  user: { id: string; name: string; email: string; image: string | null }
  roleLabel: string
  showCompanyReports?: boolean
  showCreatorBrand?: boolean
  /** Label for the company currently selected in the JWT (Open books). */
  currentCompanyName?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="platform-console relative flex min-h-svh bg-background text-foreground">
      <NavigationProgress />

      <aside className="relative z-20 flex w-[15.5rem] shrink-0 flex-col border-r border-primary/15 bg-[#0a090c] text-[#f3eee6]">
        <div className="border-b border-primary/15 px-4 py-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#c4a574]">
            {PRODUCT_NAME}
          </p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-[#f7f2ea]">Platform</p>
          <p className="mt-0.5 text-[0.7rem] text-[#c4b8a8]">Installation control</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Platform console">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors',
                  active
                    ? 'bg-[#c4a574]/15 text-[#f7f2ea] ring-1 ring-[#c4a574]/35'
                    : 'text-[#ebe4d8] hover:bg-[#c4a574]/10 hover:text-[#f7f2ea]',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md',
                    active
                      ? 'bg-[#c4a574]/20 text-[#e8d5a8]'
                      : 'bg-white/5 text-[#c4a574]',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-[0.65rem] text-[#c4b8a8]">{item.hint}</span>
                </span>
              </Link>
            )
          })}

          <div className="my-2 border-t border-primary/15" />

          <Link
            href="/dashboard"
            className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[#ebe4d8] transition-colors hover:bg-[#c4a574]/10 hover:text-[#f7f2ea]"
          >
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-white/5 text-[#c4a574]">
              <Building2Icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-medium">Open books</span>
              <span className="mt-0.5 block truncate text-[0.65rem] text-[#c4b8a8]">
                {currentCompanyName?.trim() || 'Current company'}
              </span>
            </span>
          </Link>
        </nav>

        <div className="border-t border-primary/15 px-4 py-3 text-[0.65rem] leading-relaxed text-[#a89f92]">
          <span className="font-medium text-[#c4b8a8]">{PRODUCT_NAME}</span>
          {showCreatorBrand ? (
            <>
              <span className="mx-1 opacity-50">·</span>
              <span>{PRODUCT_CREDIT}</span>
            </>
          ) : null}
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-card/90 px-4 backdrop-blur-md sm:px-6">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {PRODUCT_NAME} Platform
            </p>
            <p className="truncate text-[0.65rem] text-muted-foreground">
              Manage companies, access, and billing for this installation
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-primary/12 px-2.5 py-1 text-[0.65rem] font-medium text-primary ring-1 ring-primary/25 sm:inline">
              System owner
            </span>
            <UserMenu
              user={user}
              roleLabel={roleLabel}
              showDatabases
              showCompanyReports={showCompanyReports}
            />
          </div>
        </header>

        <main className="relative min-w-0 flex-1 px-[clamp(1rem,2vw,2rem)] py-[clamp(1rem,1.8vw,1.75rem)]">
          <div
            className={cn(
              'mx-auto w-full',
              pathname.startsWith('/databases/activity') ? 'max-w-7xl' : 'max-w-6xl',
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
