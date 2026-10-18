'use client'

import Link from 'next/link'

import { LoginThemeToggle } from '@/components/login/login-theme-toggle'
import { loginSurfaceClass, useLoginDark } from '@/components/login/login-mode'
import { LOGIN_COMPANY, LOGIN_HUB, LOGIN_STAFF } from '@/lib/login-paths'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

/** Portal door — same SOM navy base as the site, sky accent so it stays distinct from company cyan. */
export function PortalLoginShell({
  children,
  banner,
}: {
  children: React.ReactNode
  banner: React.ReactNode
}) {
  const dark = useLoginDark()

  return (
    <div
      suppressHydrationWarning
      data-login-mode={dark ? 'dark' : 'light'}
      className={cn(
        'login-portal relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10',
        loginSurfaceClass(dark),
        dark ? 'bg-[#050810] text-slate-100' : 'bg-[#f0f7fc] text-slate-900',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          dark
            ? 'bg-[radial-gradient(ellipse_70%_55%_at_50%_-8%,rgba(56,189,248,0.38),transparent),radial-gradient(ellipse_40%_35%_at_95%_85%,rgba(37,99,235,0.22),transparent),radial-gradient(ellipse_30%_28%_at_5%_75%,rgba(125,211,252,0.12),transparent)]'
            : 'bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(56,189,248,0.22),transparent),radial-gradient(ellipse_40%_35%_at_95%_90%,rgba(37,99,235,0.1),transparent)]',
        )}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LoginThemeToggle />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <p
          className={cn(
            'mb-4 text-[0.65rem] font-bold uppercase tracking-[0.22em]',
            dark ? 'text-sky-300' : 'text-sky-800',
          )}
        >
          Customer portal · {PRODUCT_NAME}
        </p>

        {banner}

        <div
          className={cn(
            'mt-4 w-full rounded-2xl border p-6 backdrop-blur-xl',
            dark
              ? 'border-sky-400/25 bg-white/5 shadow-[0_0_55px_-16px_rgba(56,189,248,0.5)]'
              : 'border-sky-200/90 bg-white shadow-[0_20px_50px_-28px_rgba(7,53,87,0.3)]',
          )}
        >
          {children}
        </div>

        <div
          className={cn(
            'mt-6 space-y-2 text-center text-sm',
            dark ? 'text-slate-400' : 'text-slate-500',
          )}
        >
          <p>
            Company staff?{' '}
            <Link
              href={LOGIN_COMPANY}
              className={cn('font-medium hover:underline', dark ? 'text-sky-300' : 'text-sky-800')}
            >
              Company login
            </Link>
          </p>
          <p>
            SOM ERP staff?{' '}
            <Link
              href={LOGIN_STAFF}
              className={cn('font-medium hover:underline', dark ? 'text-sky-300' : 'text-sky-800')}
            >
              Staff login
            </Link>
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link
              href={LOGIN_HUB}
              className={cn('text-xs hover:underline', dark ? 'text-slate-500' : 'text-slate-400')}
            >
              All sign-in options
            </Link>
            <span className={dark ? 'text-slate-600' : 'text-slate-300'}>·</span>
            <Link
              href="/"
              className={cn('text-xs hover:underline', dark ? 'text-slate-500' : 'text-slate-400')}
            >
              Website
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
