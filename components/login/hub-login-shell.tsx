'use client'

import Link from 'next/link'
import { Building2Icon, ShieldIcon, UsersIcon } from 'lucide-react'

import { LoginThemeToggle } from '@/components/login/login-theme-toggle'
import { loginSurfaceClass, useLoginDark } from '@/components/login/login-mode'
import { LOGIN_COMPANY, LOGIN_PORTAL, LOGIN_STAFF } from '@/lib/login-paths'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

const DOORS = [
  {
    href: LOGIN_STAFF,
    title: 'SOM ERP staff',
    description: 'Installation owners — open Databases and every company.',
    icon: ShieldIcon,
    accentDark: 'from-violet-600 to-indigo-600',
    accentLight: 'from-violet-500 to-indigo-500',
    linkDark: 'text-violet-300 group-hover:text-white',
    linkLight: 'text-indigo-700',
  },
  {
    href: LOGIN_COMPANY,
    title: 'Company books',
    description: 'Staff who work inside one company — sales, stock, banking.',
    icon: Building2Icon,
    accentDark: 'from-cyan-500 to-sky-600',
    accentLight: 'from-cyan-500 to-sky-500',
    linkDark: 'text-cyan-300 group-hover:text-white',
    linkLight: 'text-cyan-800',
  },
  {
    href: LOGIN_PORTAL,
    title: 'Customer portal',
    description: 'Customers view invoices and balances with their company.',
    icon: UsersIcon,
    accentDark: 'from-sky-400 to-blue-600',
    accentLight: 'from-sky-400 to-blue-500',
    linkDark: 'text-sky-300 group-hover:text-white',
    linkLight: 'text-sky-800',
  },
] as const

export function HubLoginShell() {
  const dark = useLoginDark()

  return (
    <div
      suppressHydrationWarning
      data-login-mode={dark ? 'dark' : 'light'}
      className={cn(
        'relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-12',
        loginSurfaceClass(dark),
        dark ? 'bg-[#070b14] text-white' : 'bg-[#eef6fb] text-slate-900',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          dark
            ? 'bg-[radial-gradient(ellipse_75%_55%_at_50%_-15%,rgba(34,211,238,0.28),transparent),radial-gradient(ellipse_45%_40%_at_100%_100%,rgba(99,102,241,0.22),transparent)]'
            : 'bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(34,211,238,0.18),transparent),radial-gradient(ellipse_50%_40%_at_90%_90%,rgba(56,189,248,0.14),transparent)]',
        )}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LoginThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-10 text-center">
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.2em]',
              dark ? 'text-cyan-300/90' : 'text-cyan-800',
            )}
          >
            {PRODUCT_NAME}
          </p>
          <h1
            className={cn(
              'mt-3 text-3xl font-semibold tracking-tight sm:text-4xl',
              dark ? 'text-white' : 'text-slate-900',
            )}
          >
            Choose how you sign in
          </h1>
          <p
            className={cn(
              'mx-auto mt-3 max-w-md text-sm',
              dark ? 'text-slate-300/80' : 'text-slate-600',
            )}
          >
            Three separate doors — staff, company, and customers each use their own login.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {DOORS.map((door) => {
            const Icon = door.icon
            return (
              <Link
                key={door.href}
                href={door.href}
                className={cn(
                  'group relative flex flex-col rounded-2xl border p-5 backdrop-blur-md transition',
                  dark
                    ? 'border-white/10 bg-white/5 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)] hover:bg-white/10'
                    : 'border-slate-200 bg-white shadow-sm hover:border-cyan-300 hover:shadow-md',
                )}
              >
                <span
                  className={cn(
                    'mb-4 grid size-11 place-items-center rounded-xl bg-gradient-to-br shadow-lg',
                    dark ? door.accentDark : door.accentLight,
                  )}
                >
                  <Icon className="size-5 text-white" />
                </span>
                <span className="text-base font-semibold tracking-tight">{door.title}</span>
                <span
                  className={cn(
                    'mt-2 text-xs leading-relaxed',
                    dark ? 'text-slate-300/70' : 'text-slate-500',
                  )}
                >
                  {door.description}
                </span>
                <span
                  className={cn(
                    'mt-4 text-xs font-medium',
                    dark ? door.linkDark : door.linkLight,
                  )}
                >
                  Continue →
                </span>
              </Link>
            )
          })}
        </div>

        <p
          className={cn(
            'mt-10 text-center text-xs',
            dark ? 'text-slate-400/70' : 'text-slate-500',
          )}
        >
          <Link href="/" className={dark ? 'hover:text-cyan-100' : 'hover:text-slate-800'}>
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  )
}
