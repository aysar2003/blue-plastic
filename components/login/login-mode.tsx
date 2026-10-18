'use client'

import { useBrowserStore } from '@/lib/browser-store'
import { LOGIN_DARK_KEY, parseLoginDark } from '@/lib/login-theme'
import { cn } from '@/lib/utils'

/** Class on login shells so form tokens ignore the books theme (html.som). */
export function loginSurfaceClass(dark: boolean) {
  return dark ? 'login-dark' : 'login-light'
}

/** Exposes login dark preference to children via data attribute + class. */
export function LoginMode({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const dark = parseLoginDark(useBrowserStore(LOGIN_DARK_KEY))
  return (
    <div
      data-login-mode={dark ? 'dark' : 'light'}
      className={cn(loginSurfaceClass(dark), className)}
    >
      {children}
    </div>
  )
}

export function useLoginDark(): boolean {
  return parseLoginDark(useBrowserStore(LOGIN_DARK_KEY))
}
