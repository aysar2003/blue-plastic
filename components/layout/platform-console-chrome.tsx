'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
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
        !path.startsWith('/databases/apps')),
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
 * Slate + indigo, dense SaaS-admin chrome (no Sales Create / apps rail / stock bells).
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
    <div className="platform-console relative flex min-h-svh bg-[#f4f5f8] text-slate-900 dark:bg-[#07090f] dark:text-slate-100">
      <NavigationProgress />

      <aside className="relative z-20 flex w-[15.5rem] shrink-0 flex-col border-r border-indigo-950/10 bg-[#0b1020] text-slate-100 dark:border-white/10">
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-indigo-300/90">
            {PRODUCT_NAME}
          </p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-white">Platform</p>
          <p className="mt-0.5 text-[0.7rem] text-slate-400">Installation control</p>
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
                    ? 'bg-indigo-500/20 text-white ring-1 ring-indigo-400/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 opacity-90" aria-hidden />
                <span className="min-w-0 leading-tight">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-[0.65rem] text-slate-400">{item.hint}</span>
                </span>
              </Link>
            )
          })}

          <div className="my-2 border-t border-white/10" />

          <Link
            href="/dashboard"
            className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Building2Icon className="mt-0.5 size-4 shrink-0 opacity-90" aria-hidden />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-medium">Open books</span>
              <span className="mt-0.5 block truncate text-[0.65rem] text-slate-400">
                {currentCompanyName?.trim() || 'Current company'}
              </span>
            </span>
          </Link>
        </nav>

        <div className="border-t border-white/10 px-4 py-3 text-[0.65rem] leading-relaxed text-slate-500">
          <span className="font-medium text-slate-400">{PRODUCT_NAME}</span>
          {showCreatorBrand ? (
            <>
              <span className="mx-1 opacity-50">·</span>
              <span>{PRODUCT_CREDIT}</span>
            </>
          ) : null}
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md dark:border-white/10 dark:bg-[#0c1018]/90 sm:px-6">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              {PRODUCT_NAME} Platform
            </p>
            <p className="truncate text-[0.65rem] text-slate-500 dark:text-slate-400">
              Manage companies, access, and billing for this installation
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-indigo-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-indigo-700 ring-1 ring-indigo-500/20 dark:text-indigo-200 sm:inline">
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
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
