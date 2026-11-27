'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Loader2Icon, LockIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { signOutWithHistory } from '@/app/(app)/auth/actions'
import { unlockIdleScreen } from '@/app/(app)/security/unlock-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_IDLE_LOCK_SECONDS,
  DEFAULT_SESSION_MAX_HOURS,
  clampIdleLockSeconds,
  clampSessionMaxHours,
  formatIdleLockLabel,
} from '@/lib/desk-security'
import { DESK_PIN_LENGTHS, isDeskPin, normalizeDeskPin } from '@/lib/desk-unlock'
import { fullScreenOverlayZIndex } from '@/lib/dialog-stack'
import { cn } from '@/lib/utils'

/** @deprecated Prefer idleLockSeconds from org settings. Kept for tests. */
export const IDLE_LOCK_MS = DEFAULT_IDLE_LOCK_SECONDS * 1000

const STORAGE_KEY = 'som-idle-screen-locked'
const LAST_ACTIVE_KEY = 'som-idle-last-active'
/** Ties idle-lock storage to the current auth session so a fresh login never inherits a stale lock. */
const LOGIN_AT_KEY = 'som-idle-login-at'

type UnlockMethod = 'password' | 'pin'

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

function clearIdleStorage() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(STORAGE_KEY)
  window.sessionStorage.removeItem(LAST_ACTIVE_KEY)
  window.sessionStorage.removeItem(LOGIN_AT_KEY)
}

/**
 * Drop lock / last-active leftovers from a previous sign-in in this tab.
 * Without this, logging in again immediately shows "Screen locked".
 */
function alignStorageToLogin(loginAt: number | null | undefined) {
  if (typeof window === 'undefined') return
  if (loginAt == null || !Number.isFinite(loginAt)) return
  const stored = Number(window.sessionStorage.getItem(LOGIN_AT_KEY))
  if (stored === loginAt) return
  writeLocked(false)
  writeLastActive(Date.now())
  window.sessionStorage.setItem(LOGIN_AT_KEY, String(loginAt))
}

/**
 * Idle lock + absolute session logout for the desk (computer and mobile).
 * Timeouts come from Settings → Organisation.
 * Optional desk PIN is opt-in (Profile); POS till PIN is separate.
 */
export function IdleLock({
  orgName,
  userLabel,
  hasDeskPin = false,
  idleLockSeconds = DEFAULT_IDLE_LOCK_SECONDS,
  sessionMaxHours = DEFAULT_SESSION_MAX_HOURS,
  loginAt = null,
}: {
  orgName: string
  /** Email or name shown on the lock so the cashier knows whose password. */
  userLabel: string
  /** True when this user set a desk unlock PIN in Profile. */
  hasDeskPin?: boolean
  idleLockSeconds?: number
  sessionMaxHours?: number
  /** Epoch ms when this login started. */
  loginAt?: number | null
}) {
  const router = useRouter()
  const idleMs = clampIdleLockSeconds(idleLockSeconds) * 1000
  const sessionMs = clampSessionMaxHours(sessionMaxHours) * 60 * 60 * 1000
  const idleLabel = formatIdleLockLabel(idleLockSeconds)

  const [locked, setLocked] = useState(false)
  const [method, setMethod] = useState<UnlockMethod>(hasDeskPin ? 'pin' : 'password')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [signingOut, setSigningOut] = useState(false)
  const timerRef = useRef<number | null>(null)
  const lockedRef = useRef(false)

  const lockNow = useCallback(() => {
    lockedRef.current = true
    writeLocked(true)
    setLocked(true)
    setSecret('')
    setError(null)
    setMethod(hasDeskPin ? 'pin' : 'password')
  }, [hasDeskPin])

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const signOut = useCallback(() => {
    setSigningOut(true)
    clearIdleStorage()
    void signOutWithHistory('/login/company').catch(() => {
      setSigningOut(false)
      router.push('/login/company')
    })
  }, [router])

  const armTimer = useCallback(() => {
    clearTimer()
    if (lockedRef.current) return
    timerRef.current = window.setTimeout(() => {
      lockNow()
    }, idleMs)
  }, [clearTimer, idleMs, lockNow])

  const noteActivity = useCallback(() => {
    if (lockedRef.current) return
    writeLastActive(Date.now())
    armTimer()
  }, [armTimer])

  useEffect(() => {
    // New sign-in must not reuse a prior tab's lock / idle timestamp.
    alignStorageToLogin(loginAt)

    // Restore lock across refresh, or lock if idle already exceeded while away.
    const wasLocked = readLocked()
    const idleFor = Date.now() - readLastActive()
    if (wasLocked || idleFor >= idleMs) {
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
      if (Date.now() - readLastActive() >= idleMs) lockNow()
      else armTimer()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimer()
      for (const name of events) window.removeEventListener(name, onActivity, opts)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [armTimer, clearTimer, idleMs, lockNow, loginAt, noteActivity])

  // Absolute session logout from login time (company setting).
  useEffect(() => {
    if (loginAt == null || !Number.isFinite(loginAt)) return

    const check = () => {
      if (Date.now() - loginAt >= sessionMs) signOut()
    }
    check()
    const id = window.setInterval(check, 30_000)
    return () => window.clearInterval(id)
  }, [loginAt, sessionMs, signOut])

  function unlock() {
    setError(null)
    startTransition(async () => {
      const value = method === 'pin' ? normalizeDeskPin(secret) : secret
      const result = await unlockIdleScreen({ method, secret: value })
      if (!result.ok) {
        setError(result.error)
        return
      }
      lockedRef.current = false
      writeLocked(false)
      writeLastActive(Date.now())
      setLocked(false)
      setSecret('')
      armTimer()
    })
  }

  if (!locked) return null

  const canSubmit =
    method === 'pin' ? isDeskPin(normalizeDeskPin(secret)) : Boolean(secret.trim())

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
          Idle for {idleLabel}. Enter the {method === 'pin' ? 'PIN' : 'password'} for{' '}
          <span className="font-medium text-foreground">{userLabel}</span> to continue.
        </p>

        {hasDeskPin ? (
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-md border border-border p-1">
            {(
              [
                { id: 'pin' as const, label: 'PIN' },
                { id: 'password' as const, label: 'Password' },
              ] as const
            ).map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={pending || signingOut}
                onClick={() => {
                  setMethod(row.id)
                  setSecret('')
                  setError(null)
                }}
                className={cn(
                  'rounded-sm px-2 py-1.5 text-sm font-medium transition-colors',
                  method === row.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {row.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">
            Optional: set a screen PIN in Settings → Profile (off by default).
          </p>
        )}

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            unlock()
          }}
        >
          <label className="block text-xs font-medium text-muted-foreground">
            {method === 'pin' ? `PIN (${DESK_PIN_LENGTHS.join(', ')} digits)` : 'Password'}
            <Input
              type="password"
              inputMode={method === 'pin' ? 'numeric' : undefined}
              autoComplete={method === 'pin' ? 'off' : 'current-password'}
              autoFocus
              value={secret}
              disabled={pending || signingOut}
              onChange={(event) => {
                const next = event.target.value
                setSecret(method === 'pin' ? next.replace(/\D/g, '').slice(0, 10) : next)
              }}
              className="mt-1"
              maxLength={method === 'pin' ? 10 : undefined}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={pending || signingOut || !canSubmit}>
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
