'use client'

import { useEffect, useRef, useState } from 'react'
import { MenuIcon, PinIcon, PinOffIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'

import type { OrgFeatureFlags } from '@/lib/feature-flags'
import { cn } from '@/lib/utils'
import { HeaderApps } from './app-launcher'

/**
 * QuickBooks Online left nav:
 * - icons stay in the layout
 * - hover (or the menu button) opens names over the page, without shifting it
 * - pin docks the wide menu so the page moves aside and it stays open
 */
export const SIDE_APPS_PIN_KEY = 'bp.apps-side.pinned'

function readPinned(): boolean {
  try {
    return window.localStorage.getItem(SIDE_APPS_PIN_KEY) === '1'
  } catch {
    return false
  }
}

function writePinned(pinned: boolean) {
  try {
    window.localStorage.setItem(SIDE_APPS_PIN_KEY, pinned ? '1' : '0')
  } catch {
    // Choice still applies for this visit if storage is blocked.
  }
}

/**
 * Left apps rail. Collapsed to icons; opens over the page like QuickBooks
 * until it is pinned.
 */
export function SideAppsRail({
  permissions,
  hiddenApps,
  features,
}: {
  permissions: string[]
  hiddenApps?: string[]
  features?: OrgFeatureFlags
}) {
  const pathname = usePathname()
  const railRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [peek, setPeek] = useState(false)
  const [latched, setLatched] = useState(false)
  /** Close wins over a still-hovered rail until the pointer leaves and comes back. */
  const [holdShut, setHoldShut] = useState(false)
  const hoverLocked = useRef(false)
  const [closeSignal, setCloseSignal] = useState(0)
  const [canHover, setCanHover] = useState(true)
  const [path, setPath] = useState(pathname)

  if (path !== pathname) {
    setPath(pathname)
    setLatched(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate after mount so server and client markup match
    setPinned(readPinned())
    const mq = window.matchMedia('(hover: none), (pointer: coarse)')
    const apply = () => setCanHover(!mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!latched) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (railRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-slot="portaled-floating-panel"]')) return
      setLatched(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setLatched(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [latched])

  const expanded = !holdShut && (pinned || latched || peek || menuOpen)
  const docked = pinned && !holdShut

  function openLatch() {
    hoverLocked.current = false
    setHoldShut(false)
    setLatched(true)
  }

  function shut() {
    // A click while hovered can emit leave+enter as the rail shrinks.
    // Keep hover locked until that turn finishes so it stays closed.
    hoverLocked.current = true
    setHoldShut(true)
    setPinned(false)
    writePinned(false)
    setLatched(false)
    setPeek(false)
    setCloseSignal((n) => n + 1)
  }

  function onMenuClick() {
    if (expanded) shut()
    else openLatch()
  }

  function onPinClick() {
    const next = !pinned
    hoverLocked.current = false
    setHoldShut(false)
    setPinned(next)
    writePinned(next)
    if (next) setLatched(false)
  }

  function onPointerEnter() {
    if (!canHover || hoverLocked.current) return
    setHoldShut(false)
    setPeek(true)
  }

  function onPointerLeave() {
    setPeek(false)
    queueMicrotask(() => {
      hoverLocked.current = false
    })
  }

  return (
    <div
      className={cn(
        'shell-apps relative z-30 shrink-0 self-stretch print:hidden',
        docked ? 'w-[15rem]' : 'w-14',
      )}
    >
      <aside
        ref={railRef}
        id="app-side-rail"
        data-mode={docked ? 'pinned' : expanded ? 'overlay' : 'icons'}
        data-docked={docked ? 'true' : undefined}
        data-menu-open={menuOpen ? 'true' : undefined}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className={cn(
          'shell-apps flex h-svh flex-col overflow-hidden border-r border-border/70 bg-card print:hidden',
          'transition-[width] duration-200 ease-out motion-reduce:transition-none',
          docked
            ? 'sticky top-0 w-full'
            : expanded
              ? 'fixed top-0 left-0 z-30 w-[15rem] shadow-[6px_0_28px_-10px_rgba(15,23,42,0.35)]'
              : 'fixed top-0 left-0 z-30 w-14',
        )}
      >
        <div className={cn('shrink-0', expanded ? 'px-2 pt-2' : 'flex justify-center px-1.5 pt-2')}>
          <button
            type="button"
            aria-controls="app-side-rail"
            aria-expanded={expanded}
            aria-label={expanded ? 'Close menu' : 'Open menu'}
            title={expanded ? 'Close menu' : 'Open menu'}
            onClick={onMenuClick}
            className={cn(
              'text-foreground hover:bg-muted',
              expanded
                ? 'flex h-9 w-full items-center gap-2 rounded-lg px-2'
                : 'grid size-9 place-items-center rounded-lg',
            )}
          >
            <MenuIcon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {expanded ? <span className="truncate text-xs font-semibold">Menu</span> : null}
          </button>
        </div>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            expanded ? 'px-2 py-2' : 'items-center px-1.5 py-2',
          )}
        >
          <HeaderApps
            permissions={permissions}
            hidden={hiddenApps}
            features={features}
            variant="side"
            sideExpanded={expanded}
            onMenuOpenChange={setMenuOpen}
            closeSignal={closeSignal}
          />
        </div>

        {expanded ? (
          <div className="shrink-0 border-t border-border/60 p-2">
            <button
              type="button"
              onClick={onPinClick}
              aria-pressed={pinned}
              aria-label={pinned ? 'Unpin menu' : 'Pin menu open'}
              title={pinned ? 'Unpin menu' : 'Pin menu open'}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/15"
            >
              {pinned ? (
                <PinOffIcon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              ) : (
                <PinIcon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              )}
              <span>{pinned ? 'Unpin' : 'Pin menu'}</span>
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
