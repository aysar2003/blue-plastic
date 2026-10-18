'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

import { ScrollChain } from '@/components/layout/scroll-chain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: '/portal', label: 'Home', exact: true },
  { href: '/portal/invoices', label: 'Invoices' },
  { href: '/portal/payments', label: 'Payments' },
  { href: '/portal/statement', label: 'Statements' },
]

export function PortalShell({
  companyName,
  orgId,
  userName,
  children,
}: {
  companyName: string
  orgId: string
  userName: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const signOutHref = `/login/portal?company=${encodeURIComponent(orgId)}`

  return (
    <div data-portal-shell className="min-h-svh overflow-x-clip bg-background text-foreground">
      <ScrollChain />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(70%_50%_at_50%_-5%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_55%)]"
      />
      <header className="border-b border-border bg-card/90 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[0.7rem]">
              Customer portal
            </p>
            <p className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {companyName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[10rem] truncate text-sm text-muted-foreground sm:inline md:max-w-none">
              {userName}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 touch-manipulation"
              onClick={() => signOut({ callbackUrl: signOutHref })}
            >
              Sign out
            </Button>
          </div>
        </div>
        <nav
          className="-mx-0 flex w-full max-w-5xl gap-1 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-auto sm:px-4 [&::-webkit-scrollbar]:hidden"
          aria-label="Portal"
        >
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 touch-manipulation rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl min-w-0 px-3 py-4 sm:px-4 sm:py-6 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  )
}
