'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'

import { LoginThemeToggle } from '@/components/login/login-theme-toggle'
import { loginSurfaceClass, useLoginDark } from '@/components/login/login-mode'
import { LOGIN_HUB, LOGIN_PORTAL, LOGIN_STAFF } from '@/lib/login-paths'
import { PRODUCT_CREDIT, PRODUCT_NAME } from '@/lib/product-brand'
import { LOGIN_LUXURY_STYLE, useLoginLuxury } from '@/lib/use-login-luxury'
import { cn } from '@/lib/utils'

/** Company door — cyan/sky (distinct from staff indigo and portal navy-sky). */
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
  const luxury = useLoginLuxury()

  return (
    <div
      suppressHydrationWarning
      data-login-mode={dark ? 'dark' : 'light'}
      style={luxury ? (LOGIN_LUXURY_STYLE as CSSProperties) : undefined}
      className={cn(
        'login-company relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-12',
        loginSurfaceClass(dark),
        luxury
          ? 'bg-[#07060a] text-[#f3eee6]'
          : dark
            ? 'bg-[#041018] text-white'
            : 'bg-cyan-50 text-slate-900',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          luxury
            ? 'bg-[radial-gradient(ellipse_70%_50%_at_80%_15%,rgba(196,165,116,0.3),transparent),radial-gradient(ellipse_60%_45%_at_15%_85%,rgba(196,165,116,0.22),transparent)]'
            : dark
              ? 'bg-[radial-gradient(ellipse_70%_50%_at_20%_20%,rgba(34,211,238,0.35),transparent),radial-gradient(ellipse_60%_45%_at_85%_75%,rgba(14,165,233,0.3),transparent)]'
              : 'bg-[radial-gradient(ellipse_60%_50%_at_20%_10%,rgba(34,211,238,0.22),transparent),radial-gradient(ellipse_50%_40%_at_90%_80%,rgba(14,165,233,0.14),transparent)]',
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
              luxury ? 'text-primary' : dark ? 'text-cyan-300' : 'text-cyan-800',
            )}
          >
            {PRODUCT_NAME}
          </p>
          <h1
            className={cn(
              'mt-2 text-2xl font-semibold tracking-tight',
              luxury ? 'text-[#f3eee6]' : dark ? 'text-white' : 'text-slate-900',
            )}
          >
            Company login
          </h1>
          <p
            className={cn(
              'mt-2 text-sm',
              luxury ? 'text-muted-foreground' : dark ? 'text-cyan-100' : 'text-slate-600',
            )}
          >
            Sign in to the company you work for — invoices, stock, and banking.
          </p>
        </div>

        <div
          className={cn(
            'rounded-2xl border p-6 backdrop-blur-xl',
            luxury
              ? 'border-[rgb(196_165_116/0.18)] bg-[#100e14] shadow-[0_25px_60px_-20px_rgba(196,165,116,0.38)]'
              : dark
                ? 'border-white/10 bg-white/10 shadow-[0_25px_60px_-20px_rgba(34,211,238,0.45)]'
                : 'border-cyan-200 bg-white shadow-[0_20px_50px_-28px_rgba(8,145,178,0.35)]',
          )}
        >
          {children}
        </div>

        <div
          className={cn(
            'mt-6 space-y-2 text-center text-sm',
            luxury ? 'text-muted-foreground' : dark ? 'text-cyan-200' : 'text-slate-500',
          )}
        >
          <p>
            SOM ERP staff?{' '}
            <Link
              href={LOGIN_STAFF}
              className={cn(
                'font-medium hover:underline',
                luxury ? 'text-primary' : dark ? 'text-violet-300' : 'text-indigo-700',
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
                luxury ? 'text-primary' : dark ? 'text-sky-300' : 'text-sky-800',
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
                  luxury ? 'text-primary' : dark ? 'text-cyan-300' : 'text-cyan-800',
                )}
              >
                Create your company
              </Link>
            </p>
          ) : null}
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link
              href={LOGIN_HUB}
              className={cn(
                'text-xs hover:underline',
                luxury ? 'text-muted-foreground hover:text-primary' : dark ? 'text-cyan-200' : 'text-slate-400',
              )}
            >
              All sign-in options
            </Link>
            <span className={luxury ? 'text-border' : dark ? 'text-cyan-300' : 'text-slate-300'}>·</span>
            <Link
              href="/"
              className={cn(
                'text-xs hover:underline',
                luxury ? 'text-muted-foreground hover:text-primary' : dark ? 'text-cyan-200' : 'text-slate-400',
              )}
            >
              Website
            </Link>
          </p>
        </div>

        <p
          className={cn(
            'mt-8 text-center text-[0.65rem] tracking-wide',
            luxury ? 'text-muted-foreground' : dark ? 'text-cyan-200' : 'text-slate-400',
          )}
        >
          <span
            className={cn(
              'font-medium',
              luxury ? 'text-[#f3eee6]' : dark ? 'text-cyan-100' : 'text-slate-600',
            )}
          >
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