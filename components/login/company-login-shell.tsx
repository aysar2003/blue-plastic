'use client'

import Link from 'next/link'

import { LoginThemeToggle } from '@/components/login/login-theme-toggle'
import { loginSurfaceClass, useLoginDark } from '@/components/login/login-mode'
import { LOGIN_HUB, LOGIN_PORTAL, LOGIN_STAFF } from '@/lib/login-paths'
import { PRODUCT_CREDIT, PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

/** Company door — SOM website navy / cyan, same desk as the product site. */
export function CompanyLoginShell({
  children,
  showBrand,
  canRegister,
}: {
  children: React.ReactNode
  showBrand: boolean
  canRegister: boolean
}) {
  const dark = useLoginDark()

  return (
    <div
      suppressHydrationWarning
      data-login-mode={dark ? 'dark' : 'light'}
      className={cn(
        'relative flex min-h-svh overflow-hidden',
        loginSurfaceClass(dark),
        dark ? 'bg-[#070b14] text-slate-100' : 'bg-[#eef6fb] text-slate-900',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          dark
            ? 'bg-[radial-gradient(ellipse_70%_55%_at_80%_10%,rgba(34,211,238,0.28),transparent),radial-gradient(ellipse_45%_40%_at_10%_90%,rgba(56,189,248,0.14),transparent)]'
            : 'bg-[radial-gradient(ellipse_60%_50%_at_85%_5%,rgba(34,211,238,0.22),transparent),radial-gradient(ellipse_40%_35%_at_5%_95%,rgba(14,116,144,0.1),transparent)]',
        )}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LoginThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-5xl flex-1 lg:grid-cols-2">
        <aside
          className={cn(
            'hidden flex-col justify-between p-10 text-white lg:flex',
            dark
              ? 'border-r border-cyan-400/15 bg-[#0b1220]/90'
              : 'bg-[#0b1220]',
          )}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/90">
              {PRODUCT_NAME}
            </p>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Company books</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
              Sign in to the company you work for — invoices, stock, purchases, and banking on one
              ledger.
            </p>
          </div>
          <p className="text-xs text-cyan-200/60">{PRODUCT_TAGLINE}</p>
        </aside>

        <main className="flex flex-col items-center justify-center px-4 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-6 text-center lg:text-left">
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-[0.18em] lg:hidden',
                  dark ? 'text-cyan-300' : 'text-cyan-800',
                )}
              >
                {PRODUCT_NAME}
              </p>
              <h2
                className={cn(
                  'mt-2 text-2xl font-semibold tracking-tight',
                  dark ? 'text-white' : 'text-slate-900',
                )}
              >
                Company login
              </h2>
              <p className={cn('mt-1.5 text-sm', dark ? 'text-slate-400' : 'text-slate-600')}>
                Enter your work email and password to open the books.
              </p>
            </div>

            <div
              className={cn(
                'rounded-2xl border p-6 backdrop-blur-xl',
                dark
                  ? 'border-cyan-400/20 bg-white/5 shadow-[0_0_50px_-18px_rgba(34,211,238,0.55)]'
                  : 'border-cyan-200/80 bg-white shadow-[0_20px_50px_-28px_rgba(8,47,73,0.35)]',
              )}
            >
              {children}
            </div>

            <div
              className={cn(
                'mt-6 space-y-2 text-center text-sm lg:text-left',
                dark ? 'text-slate-400' : 'text-slate-500',
              )}
            >
              <p>
                SOM ERP staff?{' '}
                <Link
                  href={LOGIN_STAFF}
                  className={cn(
                    'font-medium hover:underline',
                    dark ? 'text-cyan-300' : 'text-cyan-800',
                  )}
                >
                  Staff login
                </Link>
              </p>
              <p>
                Customer?{' '}
                <Link
                  href={LOGIN_PORTAL}
                  className={cn(
                    'font-medium hover:underline',
                    dark ? 'text-cyan-300' : 'text-cyan-800',
                  )}
                >
                  Portal login
                </Link>
              </p>
              {canRegister ? (
                <p>
                  New business?{' '}
                  <Link
                    href="/register"
                    className={cn(
                      'font-medium hover:underline',
                      dark ? 'text-cyan-300' : 'text-cyan-800',
                    )}
                  >
                    Create your company
                  </Link>
                </p>
              ) : null}
              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 lg:justify-start">
                <Link
                  href={LOGIN_HUB}
                  className={cn(
                    'text-xs hover:underline',
                    dark ? 'text-slate-500' : 'text-slate-400',
                  )}
                >
                  All sign-in options
                </Link>
                <span className={dark ? 'text-slate-600' : 'text-slate-300'}>·</span>
                <Link
                  href="/"
                  className={cn(
                    'text-xs hover:underline',
                    dark ? 'text-slate-500' : 'text-slate-400',
                  )}
                >
                  Website
                </Link>
              </p>
            </div>

            <p
              className={cn(
                'mt-8 text-center text-[0.65rem] tracking-wide lg:text-left',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              <span className={cn('font-medium', dark ? 'text-slate-300' : 'text-slate-600')}>
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
        </main>
      </div>
    </div>
  )
}
