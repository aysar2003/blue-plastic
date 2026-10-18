'use client'

import Link from 'next/link'

import { LoginThemeToggle } from '@/components/login/login-theme-toggle'
import { loginSurfaceClass, useLoginDark } from '@/components/login/login-mode'
import { LOGIN_COMPANY, LOGIN_HUB, LOGIN_PORTAL } from '@/lib/login-paths'
import { PRODUCT_CREDIT, PRODUCT_NAME } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

export function StaffLoginShell({
  children,
  showBrand,
}: {
  children: React.ReactNode
  showBrand: boolean
}) {
  const dark = useLoginDark()

  return (
    <div
      suppressHydrationWarning
      data-login-mode={dark ? 'dark' : 'light'}
      className={cn(
        'relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-12',
        loginSurfaceClass(dark),
        dark ? 'bg-[#07041a] text-white' : 'bg-indigo-50 text-slate-900',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          dark
            ? 'bg-[radial-gradient(ellipse_70%_50%_at_20%_20%,rgba(99,102,241,0.4),transparent),radial-gradient(ellipse_60%_45%_at_85%_75%,rgba(139,92,246,0.35),transparent)]'
            : 'bg-[radial-gradient(ellipse_60%_50%_at_20%_10%,rgba(99,102,241,0.2),transparent),radial-gradient(ellipse_50%_40%_at_90%_80%,rgba(139,92,246,0.15),transparent)]',
        )}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LoginThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <p
            className={cn(
              'text-[0.65rem] font-bold uppercase tracking-[0.25em]',
              dark ? 'text-indigo-300' : 'text-indigo-700',
            )}
          >
            {PRODUCT_NAME}
          </p>
          <h1
            className={cn(
              'mt-2 text-2xl font-semibold tracking-tight',
              dark ? 'text-white' : 'text-slate-900',
            )}
          >
            Staff login
          </h1>
          <p className={cn('mt-2 text-sm', dark ? 'text-indigo-100/70' : 'text-slate-600')}>
            For installation owners. Opens Databases across every company.
          </p>
        </div>

        <div
          className={cn(
            'rounded-2xl border p-6 backdrop-blur-xl',
            dark
              ? 'border-white/10 bg-white/10 shadow-[0_25px_60px_-20px_rgba(99,102,241,0.55)]'
              : 'border-indigo-200 bg-white shadow-[0_20px_50px_-28px_rgba(79,70,229,0.4)]',
          )}
        >
          {children}
        </div>

        <div
          className={cn(
            'mt-6 space-y-2 text-center text-sm',
            dark ? 'text-indigo-100/60' : 'text-slate-500',
          )}
        >
          <p>
            Company staff?{' '}
            <Link
              href={LOGIN_COMPANY}
              className={cn('font-medium hover:underline', dark ? 'text-violet-300' : 'text-indigo-700')}
            >
              Company login
            </Link>
          </p>
          <p>
            Customer?{' '}
            <Link
              href={LOGIN_PORTAL}
              className={cn('font-medium hover:underline', dark ? 'text-violet-300' : 'text-indigo-700')}
            >
              Portal login
            </Link>
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link
              href={LOGIN_HUB}
              className={cn('text-xs hover:underline', dark ? 'text-indigo-200/50' : 'text-slate-400')}
            >
              All sign-in options
            </Link>
            <span className={dark ? 'text-indigo-200/30' : 'text-slate-300'}>·</span>
            <Link
              href="/"
              className={cn('text-xs hover:underline', dark ? 'text-indigo-200/50' : 'text-slate-400')}
            >
              Website
            </Link>
          </p>
        </div>

        <p
          className={cn(
            'mt-8 text-center text-[0.65rem] tracking-wide',
            dark ? 'text-indigo-200/40' : 'text-slate-400',
          )}
        >
          <span className={cn('font-medium', dark ? 'text-indigo-100/70' : 'text-slate-600')}>
            {PRODUCT_NAME}
          </span>
          {showBrand ? (
            <>
              <span className="mx-1.5">·</span>
              <span>{PRODUCT_CREDIT}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}
