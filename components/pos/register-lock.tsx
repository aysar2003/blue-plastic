'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { CameraIcon, ShoppingBasketIcon } from 'lucide-react'

export function lockStorageKey(registerId: string) {
  return `bp-register-lock:${registerId}`
}

export function readRegisterLocked(registerId: string) {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(lockStorageKey(registerId)) === '1'
}

function lockEvent(registerId: string) {
  return `bp-register-lock-event:${registerId}`
}

export function writeRegisterLocked(registerId: string, locked: boolean) {
  const key = lockStorageKey(registerId)
  if (locked) window.sessionStorage.setItem(key, '1')
  else window.sessionStorage.removeItem(key)
  window.dispatchEvent(new Event(lockEvent(registerId)))
}

/** Whether this browser session has the register locked. Server render is unlocked. */
export function useRegisterLocked(registerId: string) {
  return (
    useSyncExternalStore(
      (onChange) => {
        const name = lockEvent(registerId)
        window.addEventListener(name, onChange)
        return () => window.removeEventListener(name, onChange)
      },
      () => (readRegisterLocked(registerId) ? '1' : '0'),
      () => '0',
    ) === '1'
  )
}

export function useClientReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function clock(now: Date) {
  const hours = now.getHours()
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return {
    time: `${String(hour12).padStart(2, '0')}:${minutes}:${seconds} ${suffix}`,
    date: `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${String(now.getDate()).padStart(2, '0')}, ${now.getFullYear()}`,
  }
}

/**
 * The register lock. Unlock returns to the till; Backend leaves the register
 * for the rest of the books. Nothing is posted from this screen.
 */
export function RegisterLock({
  orgName,
  onUnlock,
  unlockHref,
  backendHref = '/dashboard',
}: {
  orgName: string
  onUnlock?: () => void
  unlockHref?: string
  backendHref?: string
}) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const tick = () => setNow(new Date())
    const start = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(id)
    }
  }, [])

  const shown = now ? clock(now) : { time: '—', date: '' }

  const unlock = (
    <span className="flex flex-col items-center gap-3 text-[#1e1b2e]">
      <ShoppingBasketIcon className="size-8" strokeWidth={1.75} />
      <span className="text-sm font-medium">Unlock Register</span>
    </span>
  )

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#ece7f6] text-[#1c1730]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 32%), linear-gradient(295deg, rgba(196,184,230,0.55) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, #f7f4fc 0%, #e4dff2 100%)',
        }}
      />
      <header className="relative flex items-start justify-between px-8 pt-8">
        <div>
          <p className="text-3xl font-light tracking-tight tabular-nums">{shown.time}</p>
          <p className="mt-1 text-sm text-[#3c3558]">{shown.date}</p>
        </div>
        <p className="text-lg font-semibold tracking-[0.18em]">{orgName.toUpperCase()}</p>
        <Link href="/settings/organization" className="flex items-center gap-2 text-sm text-[#5b4d86] hover:underline">
          <CameraIcon className="size-4" />
          Your logo
        </Link>
      </header>

      <div className="relative flex flex-1 items-center justify-center">
        {onUnlock ? (
          <button
            type="button"
            onClick={onUnlock}
            className="grid size-40 place-items-center rounded-2xl bg-white shadow-[0_18px_50px_-24px_rgba(40,20,80,0.45)]"
          >
            {unlock}
          </button>
        ) : (
          <Link
            href={unlockHref ?? '/pos'}
            className="grid size-40 place-items-center rounded-2xl bg-white shadow-[0_18px_50px_-24px_rgba(40,20,80,0.45)]"
          >
            {unlock}
          </Link>
        )}
      </div>

      <footer className="relative flex justify-center pb-10">
        <Link
          href={backendHref}
          className="rounded-md bg-[#1e2433] px-5 py-2 text-sm font-medium text-white hover:bg-[#121722]"
        >
          Backend
        </Link>
      </footer>
    </div>
  )
}
