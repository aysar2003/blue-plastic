'use client'

import { MoonIcon, SunIcon } from 'lucide-react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import { LOGIN_DARK_KEY, parseLoginDark } from '@/lib/login-theme'
import { cn } from '@/lib/utils'

export function LoginThemeToggle({ className }: { className?: string }) {
  const dark = parseLoginDark(useBrowserStore(LOGIN_DARK_KEY))

  return (
    <button
      type="button"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      onClick={() => writeBrowserStore(LOGIN_DARK_KEY, dark ? '0' : '1')}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full border transition-colors',
        dark
          ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        className,
      )}
    >
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  )
}
