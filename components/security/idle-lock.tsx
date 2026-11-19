'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Loader2Icon, LockIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { signOutWithHistory } from '@/app/(app)/auth/actions'
import { unlockIdleScreen } from '@/app/(app)/security/unlock-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fullScreenOverlayZIndex } from '@/lib/dialog-stack'

/** Idle before the desk lock appears. */
export const IDLE_LOCK_MS = 15 * 60 * 1000

const STORAGE_KEY = 'som-idle-screen-locked'
const LAST_ACTIVE_KEY = 'som-idle-last-active'

function readLocked(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(STORAGE_KEY) === '1'
}

function writeLocked(locked: boolean) {
  if (typeof window === 'undefined') return
  if (locked) window.sessionStorage.setItem(STORAGE_KEY, '1')
  else window.sessionStorage.removeItem(STORAGE_KEY)
}

function readLastActive(): number {
  if (typeof window === 'undefined') return Date.now()
  const raw = window.sessionStorage.getItem(LAST_ACTIVE_KEY)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : Date.now()
}

function writeLastActive(at: number) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(LAST_ACTIVE_KEY, String(at))
}

/**
 * After 15 minutes without pointer/keyboard activity, covers the desk with a
 * password lock. Unlock uses the signed-in user's normal login password.
 * Absolute session lifetime (10h) is enforced by NextAuth maxAge separately.
 */
export function IdleLock({
  orgName,
  userLabel,
}: {
  orgName: string
  /** Email or name shown on the lock so the cashier knows whose password. */
  userLabel: string
}) {
  const router = useRouter()
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [signingOut, setSigningOut] = useState(false)
  const timerRef = useRef<number | null>(null)
  const lockedRef = useRef(false)

  const lockNow = useCallback(() => {
    lockedRef.current = true
    writeLocked(true)
    setLocked(true)
    setPassword('')
    setError(null)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const armTimer = useCallback(() => {
    clearTimer()
    if (lockedRef.current) return
    timerRef.current = window.setTimeout(() => {
      lockNow()
    }, IDLE_LOCK_MS)
  }, [clearTimer, lockNow])

  const noteActivity = useCallback(() => {
    if (lockedRef.current) return
    writeLastActive(Date.now())
    armTimer()
  }, [armTimer])

  useEffect(() => {
    // Restore lock across refresh, or lock if idle already exceeded while away.
    const wasLocked = readLocked()
    const idleFor = Date.now() - readLastActive()
    if (wasLocked || idleFor >= IDLE_LOCK_MS) {
      lockNow()
    } else {
      writeLastActive(Date.now())
      armTimer()
    }

    const onActivity = () => noteActivity()
    const opts: AddEventListenerOptions = { capture: true, passive: true }
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const
    for (const name of events) window.addEventListener(name, onActivity, opts)

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (lockedRef.current) return
      if (Date.now() - readLastActive() >= IDLE_LOCK_MS) lockNow()
      else armTimer()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimer()
      for (const name of events) window.removeEventListener(name, onActivity, opts)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [armTimer, clearTimer, lockNow, noteActivity])

  function unlock() {
    setError(null)
    startTransition(async () => {
      const result = await unlockIdleScreen(password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      lockedRef.current = false
      writeLocked(false)
      writeLastActive(Date.now())
      setLocked(false)
      setPassword('')
      armTimer()
    })
  }

  function signOut() {
    setSigningOut(true)
    writeLocked(false)
    void signOutWithHistory('/login/company').catch(() => {
      setSigningOut(false)
      router.push('/login/company')
    })
  }

  if (!locked) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-lock-title"
      className="fixed inset-0 flex flex-col items-center justify-center bg-background/95 px-4 backdrop-blur-sm"
      style={{ zIndex: fullScreenOverlayZIndex(90) }}
      onKeyDown={(event) => {
        // Escape must not dismiss without a password.
        if (event.key === 'Escape') event.preventDefault()
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-muted">
            <LockIcon className="size-5 text-foreground" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {orgName}
            </p>
            <h2 id="idle-lock-title" className="text-base font-semibold text-foreground">
              Screen locked
            </h2>
          </div>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Idle for 15 minutes. Enter the password for <span className="font-medium text-foreground">{userLabel}</span>{' '}
          to continue.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            unlock()
          }}
        >
          <label className="block text-xs font-medium text-muted-foreground">
            Password
            <Input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              disabled={pending || signingOut}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={pending || signingOut || !password.trim()}>
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Unlock
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || signingOut}
              onClick={signOut}
            >
              {signingOut ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Sign out
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
