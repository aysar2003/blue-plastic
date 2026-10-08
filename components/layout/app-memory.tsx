'use client'

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  APP_RESTORE_KEY,
  appForPath,
  doorHref,
  forgetHref,
  isSafeHref,
  journeyOwner,
  memoryKey,
  parseMemory,
  rememberPlace,
  rememberScroll,
  type AppMemory,
  type AppRoot,
  type Arrival,
} from '@/lib/app-memory'
import { APP_ALSO, LAUNCHER_APPS } from './launcher-apps'

const ROOTS: AppRoot[] = LAUNCHER_APPS.map((app) => ({ key: app.key, href: app.href, also: APP_ALSO[app.key] }))
const JOURNEY_KEY = 'bp-app-journey'
/** A click this recent explains the navigation that follows it. */
const CLICK_WINDOW_MS = 5000

type Door = { href: string; onClick: () => void; remembered: boolean }

type MemoryApi = {
  door: (key: string, root: string) => Door
  forgetAll: () => void
  forgetHere: () => string | null
  remembersAnything: boolean
}

const MemoryContext = createContext<MemoryApi | null>(null)

const EMPTY: AppMemory = {}
let cached: { key: string; raw: string | null; memory: AppMemory } | null = null
const listeners = new Set<() => void>()

/** Stable snapshot of what this browser remembers (re-parsed only when the stored text changes). */
function readStore(key: string): AppMemory {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return EMPTY
  }
  if (cached && cached.key === key && cached.raw === raw) return cached.memory
  const memory = parseMemory(raw, Date.now())
  cached = { key, raw, memory }
  return memory
}

function writeStore(key: string, memory: AppMemory) {
  try {
    if (Object.keys(memory).length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(memory))
  } catch {
    // Private mode / quota: remembering is a convenience, never an error.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab of the same browser remembered something.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

type Restore = { href: string; root: string; scrollY?: number }

function readRestore(): Restore | null {
  try {
    const raw = sessionStorage.getItem(APP_RESTORE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && isSafeHref(parsed.href) && isSafeHref(parsed.root)) return parsed
  } catch {}
  return null
}

function writeRestore(value: Restore | null) {
  try {
    if (value) sessionStorage.setItem(APP_RESTORE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(APP_RESTORE_KEY)
  } catch {}
}

function readJourney(): { owner: string | null; pathname: string | null } {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(JOURNEY_KEY) ?? 'null')
    if (parsed && typeof parsed === 'object') {
      return {
        owner: typeof parsed.owner === 'string' ? parsed.owner : null,
        pathname: typeof parsed.pathname === 'string' ? parsed.pathname : null,
      }
    }
  } catch {}
  return { owner: null, pathname: null }
}

function writeJourney(value: { owner: string | null; pathname: string }) {
  try {
    sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(value))
  } catch {}
}

function hereHref() {
  return `${window.location.pathname}${window.location.search}`
}

/** Scroll back once the restored page is tall enough; give up when the user scrolls. */
function restoreScroll(target: number) {
  const started = Date.now()
  let settled = 0
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }
  window.addEventListener('wheel', cancel, { once: true, passive: true })
  window.addEventListener('touchstart', cancel, { once: true, passive: true })
  window.addEventListener('keydown', cancel, { once: true })
  const tick = () => {
    // Data-heavy screens stream in; wait up to 8s for the page to grow tall enough.
    if (cancelled || Date.now() - started > 8000) return
    const room = document.documentElement.scrollHeight - window.innerHeight
    if (room >= target - 2) {
      if (Math.abs(window.scrollY - target) > 3) window.scrollTo({ top: target })
      else if (++settled >= 3) return
    }
    window.setTimeout(tick, 100)
  }
  window.setTimeout(tick, 50)
}

export function AppMemoryProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const storeKey = memoryKey(userId)
  const memory = useSyncExternalStore(
    subscribe,
    () => readStore(storeKey),
    () => EMPTY,
  )
  const [currentHref, setCurrentHref] = useState<string | null>(null)

  // Always fold into what is stored now, so two tabs do not erase each other.
  const update = useCallback(
    (change: (memory: AppMemory) => AppMemory) => {
      const before = readStore(storeKey)
      const after = change(before)
      if (after !== before) writeStore(storeKey, after)
    },
    [storeKey],
  )

  const api = useMemo<MemoryApi>(
    () => ({
      door: (key, root) => {
        const href = doorHref({ memory, key, root, currentHref, now: Date.now() })
        const place = memory[key]
        return {
          href,
          remembered: href !== root,
          onClick: () => {
            writeRestore(
              href === root ? null : { href, root, ...(place?.href === href && place.scrollY ? { scrollY: place.scrollY } : {}) },
            )
          },
        }
      },
      forgetAll: () => writeStore(storeKey, {}),
      forgetHere: () => {
        const href = hereHref()
        update((before) => forgetHref(before, href))
        const restore = readRestore()
        if (restore && restore.href === href) {
          writeRestore(null)
          return restore.root
        }
        return null
      },
      remembersAnything: Object.keys(memory).length > 0,
    }),
    [memory, currentHref, storeKey, update],
  )

  return (
    <MemoryContext.Provider value={api}>
      <Suspense fallback={null}>
        <PlaceRecorder update={update} onHref={setCurrentHref} />
      </Suspense>
      {children}
    </MemoryContext.Provider>
  )
}

function PlaceRecorder({
  update,
  onHref,
}: {
  update: (change: (memory: AppMemory) => AppMemory) => void
  onHref: (href: string) => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const href = search ? `${pathname}?${search}` : pathname
  const intent = useRef<{ kind: Arrival; at: number } | null>(null)
  const hrefRef = useRef(href)

  // How the next screen will be reached: the app switcher, a link inside the
  // page, or the surrounding chrome (search, quick create, user menu).
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const kind: Arrival = event.target.closest('[data-app-nav]')
        ? 'app'
        : event.target.closest('main')
          ? 'content'
          : 'other'
      intent.current = { kind, at: Date.now() }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    hrefRef.current = href
    const last = intent.current
    intent.current = null
    const arrival: Arrival = last && Date.now() - last.at < CLICK_WINDOW_MS ? last.kind : 'other'
    const previous = readJourney()
    const pathApp = appForPath(pathname, ROOTS)
    const owner = journeyOwner({
      previousOwner: previous.owner,
      previousPathname: previous.pathname,
      pathname,
      pathApp,
      arrival,
    })
    writeJourney({ owner, pathname })
    onHref(href)

    // A missing record is not a place to come back to (see ForgetMissingPlace).
    if (!document.querySelector('[data-route-missing]')) {
      update((before) => rememberPlace(before, { owner, pathApp, href, now: Date.now() }))
    }

    const restore = readRestore()
    if (restore && restore.href === href) {
      if (restore.scrollY) restoreScroll(restore.scrollY)
      // Keep the marker briefly so a not-found page can still fall back to the list.
      window.setTimeout(() => {
        if (readRestore()?.href === href) writeRestore(null)
      }, 4000)
    }
  }, [href, pathname, update, onHref])

  useEffect(() => {
    let timer: number | null = null
    const onScroll = () => {
      if (timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        const at = hereHref()
        if (at !== hrefRef.current) return
        update((before) => rememberScroll(before, at, window.scrollY))
      }, 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [update])

  return null
}

/** Where an app's tile / chip / menu row leads: the place left there, else its start. */
export function useAppDoor(key: string, root: string): Door {
  const api = useContext(MemoryContext)
  return api ? api.door(key, root) : { href: root, onClick: () => {}, remembered: false }
}

export function useAppMemoryControls() {
  const api = useContext(MemoryContext)
  return {
    remembersAnything: api?.remembersAnything ?? false,
    forgetAll: api?.forgetAll ?? (() => {}),
  }
}

/**
 * Mounted by not-found / error screens. The place stops being remembered, and
 * when the user arrived here by reopening an app, they are taken to that app's
 * start instead (once — the place is already forgotten, so no loop).
 */
export function ForgetMissingPlace() {
  const api = useContext(MemoryContext)
  const router = useRouter()
  useEffect(() => {
    if (!api) return
    const fallback = api.forgetHere()
    if (fallback) router.replace(fallback)
    // Run once per screen; api changes identity with every memory update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])
  return <span data-route-missing hidden />
}
