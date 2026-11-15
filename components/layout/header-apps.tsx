'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AppGlyph, isAppGlyph } from '@/components/layout/app-glyphs'
import { usePathname } from 'next/navigation'
import {
  ChevronDownIcon,
  LayoutGridIcon,
  RotateCcwIcon,
} from 'lucide-react'
import dynamic from 'next/dynamic'

import { PortaledFloatingPanel } from '@/components/ui/portaled-floating-panel'
import type { OrgFeatureFlags } from '@/lib/feature-flags'
import { cn } from '@/lib/utils'
import { AppDestinationsPanel, DestinationRow } from './app-destinations-panel'
import { menuForApp } from './header-app-menus'
import {
  APP_ALSO,
  appsForPermissions,
  type LauncherApp,
} from './launcher-apps'
import { LAUNCHER_ICONS } from './launcher-icon-map'
import { useAppDoor, useAppMemoryControls } from './app-memory'

const ICONS = LAUNCHER_ICONS

/** Reports menu is heavy — load only when Reports opens. */
const ReportsMenuPanel = dynamic(
  () => import('./reports-menu-panel').then((m) => ({ default: m.ReportsMenuPanel })),
  { ssr: false },
)

function appIsCurrent(pathname: string, href: string, also: string[] = []) {
  const paths = [href, ...also]
  return paths.some((path) => {
    const base = path.split(/[?#]/)[0] || '/'
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

/** Darken a hex accent until it reads on a light wash tile (side-rail icons). */
function readableAccent(accent: string, wash: string): string {
  const hex = (value: string) => {
    const raw = value.replace('#', '').trim()
    if (raw.length === 3) {
      return [0, 1, 2].map((i) => parseInt(raw[i]! + raw[i]!, 16))
    }
    if (raw.length !== 6) return null
    return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16))
  }
  const toHex = (channels: number[]) =>
    `#${channels.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`
  const lum = (channels: number[]) => {
    const [r, g, b] = channels.map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const ink = hex(accent)
  const paper = hex(wash)
  if (!ink || !paper) return accent
  let channels = [...ink]
  for (let i = 0; i < 6; i++) {
    const ratio =
      (Math.max(lum(channels), lum(paper)) + 0.05) /
      (Math.min(lum(channels), lum(paper)) + 0.05)
    if (ratio >= 3) break
    channels = channels.map((c) => c * 0.82)
  }
  return toHex(channels)
}

/**
 * The apps, in the top bar (or left rail), so any screen can open one directly.
 *
 * Top bar always shows every permitted top-level app as a colorful tile.
 * One click on a chip opens its destination list; pick an item from there.
 * Nothing opens on hover. Apps with no children still go straight to the hub.
 * The Apps button opens the full app list the same way.
 * Turn apps on/off in Settings → Apps & features.
 */
export function HeaderApps({
  permissions,
  hidden,
  features,
  variant = 'top',
  sideExpanded = false,
  onMenuOpenChange,
  closeSignal = 0,
}: {
  permissions: string[]
  hidden?: string[]
  features?: OrgFeatureFlags
  /** Top chips (default) or a left icon rail. */
  variant?: 'top' | 'side'
  /** Side rail showing icon + label (hover / pinned open). */
  sideExpanded?: boolean
  /** Lets the side rail stay open while a destination menu is open. */
  onMenuOpenChange?: (open: boolean) => void
  /** Bumps when the side rail is forced shut, so an open destination list closes too. */
  closeSignal?: number
}) {
  const pathname = usePathname()
  const apps = useMemo(() => {
    const all = appsForPermissions(permissions)
    return hidden && hidden.length > 0 ? all.filter((app) => !hidden.includes(app.key)) : all
  }, [permissions, hidden])
  const home = pathname === '/dashboard'
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [openPath, setOpenPath] = useState(pathname)
  const [seenClose, setSeenClose] = useState(closeSignal)
  if (openPath !== pathname) {
    setOpenPath(pathname)
    setOpenKey(null)
  }
  if (closeSignal !== seenClose) {
    setSeenClose(closeSignal)
    setOpenKey(null)
  }
  // Tell the side rail after render. Calling it here updated SideAppsRail
  // while HeaderApps was still rendering, and the error covered the report.
  useEffect(() => {
    onMenuOpenChange?.(false)
  }, [pathname, closeSignal, onMenuOpenChange])
  const appsTriggerRef = useRef<HTMLButtonElement>(null)
  const side = variant === 'side'
  const showSideLabels = side && sideExpanded
  const panelPlacement = side ? 'right' : 'bottom'

  const closeMenus = () => {
    setOpenKey(null)
    onMenuOpenChange?.(false)
  }
  const setMenuKey = (key: string | null) => {
    setOpenKey(key)
    onMenuOpenChange?.(key != null)
  }
  const appsMenuOpen = openKey === '__apps__'

  // Top bar always lists every top-level app (colorful tiles). Side rail
  // pins Settings/Help at the bottom; everything else scrolls above.
  const primary = side
    ? apps.filter((app) => app.key !== 'settings' && app.key !== 'help')
    : apps
  const pinned = side
    ? apps.filter((app) => app.key === 'settings' || app.key === 'help')
    : []

  return (
    <nav
      aria-label="Apps"
      data-app-nav
      data-variant={variant}
      data-side-expanded={showSideLabels ? 'true' : undefined}
      className={
        side
          ? cn(
              'flex h-full min-h-0 flex-col gap-1 py-1',
              showSideLabels ? 'items-stretch' : 'items-center',
            )
          : 'flex flex-wrap items-center gap-x-1 gap-y-1.5'
      }
    >
      <div className={cn('relative', side && 'shrink-0', showSideLabels && 'w-full')}>
        <button
          ref={appsTriggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={appsMenuOpen}
          aria-current={home ? 'page' : undefined}
          aria-label="Apps"
          title={side && !showSideLabels ? undefined : 'Apps'}
          onClick={() => setMenuKey(openKey === '__apps__' ? null : '__apps__')}
          className={cn(
            side
              ? showSideLabels
                ? 'flex h-9 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold text-foreground hover:bg-muted'
                : 'grid size-9 place-items-center rounded-lg text-primary hover:bg-card'
              : 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-foreground hover:bg-muted/80',
            (home || appsMenuOpen) &&
              (side
                ? 'bg-card shadow-sm ring-1 ring-border'
                : 'bg-card text-foreground shadow-sm ring-1 ring-border dark:text-foreground'),
          )}
        >
          {side ? (
            <LayoutGridIcon
              className="size-4 shrink-0 text-primary"
              aria-hidden
            />
          ) : (
            <span className="grid size-7 place-items-center rounded-md bg-muted text-foreground">
              <LayoutGridIcon className="size-3.5" aria-hidden />
            </span>
          )}
          {side && !showSideLabels ? <span className="sr-only">Apps</span> : null}
          {side && showSideLabels ? <span className="truncate">Apps</span> : null}
          {!side ? 'Apps' : null}
          {!side ? (
            <ChevronDownIcon
              className={cn('size-3 opacity-60 transition-transform', appsMenuOpen && 'rotate-180')}
              aria-hidden
            />
          ) : null}
        </button>
        {side && !showSideLabels && !appsMenuOpen ? (
          <SideIconTip label="Apps" anchorRef={appsTriggerRef} />
        ) : null}
        <PortaledFloatingPanel
          open={appsMenuOpen}
          anchorRef={appsTriggerRef}
          onClose={closeMenus}
          placement={panelPlacement}
          scrollIsolate={side}
          closeOnPointerLeaveDelayMs={side ? 1000 : undefined}
          className="min-w-[14rem]"
        >
          <ul
            role="menu"
            aria-label="All apps"
            className="max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-border bg-popover py-1.5 text-popover-foreground shadow-[0_8px_28px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/5"
          >
            <li>
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={closeMenus}
                className="block px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
              >
                Apps home
              </Link>
            </li>
            <li className="my-1 border-t border-border" aria-hidden />
            {apps.map((app) => (
              <AppsMenuRow key={app.key} app={app} onDone={closeMenus} />
            ))}
            <ForgetPlacesRow onDone={closeMenus} />
          </ul>
        </PortaledFloatingPanel>
      </div>
      <div
        data-side-scroll={side ? '' : undefined}
        className={
          side
            ? cn(
                'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-none',
                showSideLabels ? 'items-stretch' : 'items-center',
              )
            : 'contents'
        }
      >
        {primary.map((app) => (
          <HeaderAppChip
            key={app.key}
            app={app}
            pathname={pathname}
            permissions={permissions}
            features={features}
            open={openKey === app.key}
            onClose={closeMenus}
            onToggle={() => setMenuKey(openKey === app.key ? null : app.key)}
            variant={variant}
            panelPlacement={panelPlacement}
            sideExpanded={showSideLabels}
          />
        ))}
      </div>
      {pinned.length > 0 ? (
        <div
          className={cn(
            'mt-auto flex shrink-0 flex-col gap-1 border-t border-border/60 pt-1',
            showSideLabels ? 'items-stretch' : 'items-center',
          )}
        >
          {pinned.map((app) => (
            <HeaderAppChip
              key={app.key}
              app={app}
              pathname={pathname}
              permissions={permissions}
              features={features}
              open={openKey === app.key}
              onClose={closeMenus}
              onToggle={() => setMenuKey(openKey === app.key ? null : app.key)}
              variant={variant}
              panelPlacement={panelPlacement}
              sideExpanded={showSideLabels}
            />
          ))}
        </div>
      ) : null}
    </nav>
  )
}

function HeaderAppChip({
  app,
  pathname,
  permissions,
  features,
  open,
  onClose,
  onToggle,
  variant = 'top',
  panelPlacement = 'bottom',
  sideExpanded = false,
}: {
  app: LauncherApp
  pathname: string
  permissions: string[]
  features?: OrgFeatureFlags
  open: boolean
  onClose: () => void
  onToggle: () => void
  variant?: 'top' | 'side'
  panelPlacement?: 'bottom' | 'right'
  sideExpanded?: boolean
}) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const Icon = ICONS[app.icon]
  const current = appIsCurrent(pathname, app.href, APP_ALSO[app.key])
  const children = menuForApp(app.key, permissions, features)
  const hasMenu = children.length > 0
  const menuOpen = open && hasMenu
  const side = variant === 'side'

  return (
    <div
      className={cn(
        'relative inline-flex items-center',
        side && 'shrink-0',
        sideExpanded && 'w-full',
      )}
    >
      <AppChipLink
        app={app}
        current={current}
        hasMenu={hasMenu}
        open={menuOpen}
        triggerRef={triggerRef}
        onToggleMenu={onToggle}
        onDone={onClose}
        variant={variant}
        sideExpanded={sideExpanded}
      >
        {side ? (
          sideExpanded ? (
            <>
              <span
                className="grid size-6 shrink-0 place-items-center rounded-md"
                style={{ backgroundColor: app.wash, color: app.accent }}
              >
                <Icon className="size-3.5" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-foreground">
                {app.label}
              </span>
            </>
          ) : (
            <>
              <span className="sr-only">{app.label}</span>
              <Icon className="size-4" strokeWidth={2} aria-hidden />
            </>
          )
        ) : (
          <>
            <span
              className="grid size-7 shrink-0 place-items-center rounded-md shadow-sm ring-1 ring-black/5"
              style={{ backgroundColor: app.wash, color: app.accent }}
            >
              <Icon className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            <span className="max-w-[7.5rem] truncate">{app.label}</span>
            {hasMenu ? (
              <ChevronDownIcon
                className={cn('size-3 shrink-0 opacity-55 transition-transform', menuOpen && 'rotate-180')}
                aria-hidden
              />
            ) : null}
          </>
        )}
      </AppChipLink>
      {side && !sideExpanded && !menuOpen ? (
        <SideIconTip label={app.label} anchorRef={triggerRef} />
      ) : null}
      {hasMenu ? (
        <PortaledFloatingPanel
          open={menuOpen}
          anchorRef={triggerRef}
          onClose={onClose}
          placement={panelPlacement}
          scrollIsolate={side || app.key === 'reports'}
          closeOnPointerLeaveDelayMs={side ? 1000 : undefined}
          className={cn(side ? undefined : 'min-w-[13.5rem]', app.key === 'reports' && !side && 'min-w-[18rem]')}
        >
          {side ? (
            app.key === 'reports' ? (
              <div
                role="menu"
                aria-label={`${app.label} apps`}
                className="rounded-xl border border-border bg-popover shadow-[0_8px_28px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/5"
              >
                <div className="sticky top-0 z-10 border-b border-border bg-popover px-3 py-2">
                  <Link
                    href={app.href}
                    role="menuitem"
                    onClick={onClose}
                    className="block text-xs font-bold text-foreground hover:underline"
                  >
                    Reports home
                  </Link>
                </div>
                <ReportsMenuPanel items={children} onDone={onClose} withIcons />
              </div>
            ) : (
              <AppDestinationsPanel
                appLabel={app.label}
                appHref={app.href}
                items={children}
                onDone={onClose}
              />
            )
          ) : app.key === 'reports' ? (
            <div
              role="menu"
              aria-label={`${app.label} apps`}
              className="rounded-xl border border-border bg-popover shadow-[0_8px_28px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/5"
            >
              <div className="border-b border-border px-3 py-1.5">
                <Link
                  href={app.href}
                  role="menuitem"
                  onClick={onClose}
                  className="block text-xs font-bold text-foreground hover:underline"
                >
                  Reports home
                </Link>
              </div>
              <ReportsMenuPanel items={children} onDone={onClose} />
            </div>
          ) : (
            <ul
              role="menu"
              aria-label={`${app.label} apps`}
              className="max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-border bg-popover py-1.5 text-popover-foreground shadow-[0_8px_28px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/5"
            >
              <li>
                <Link
                  href={app.href}
                  role="menuitem"
                  onClick={onClose}
                  className="block px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                >
                  {app.label} home
                </Link>
              </li>
              <li className="my-1 border-t border-border" aria-hidden />
              {children.map((item) => (
                <li key={`${app.key}-${item.href ?? item.label}-${item.label}`}>
                  {item.icon ? (
                    <DestinationRow
                      item={item}
                      fallbackHref={app.href}
                      onDone={onClose}
                      dense
                    />
                  ) : (
                    <Link
                      href={item.href ?? app.href}
                      role="menuitem"
                      onClick={onClose}
                      className="block px-3 py-1.5 hover:bg-muted"
                    >
                      <span className="block text-xs font-semibold text-foreground">
                        {item.label}
                      </span>
                      {item.blurb ? (
                        <span className="block text-[0.65rem] leading-snug text-muted-foreground">
                          {item.blurb}
                        </span>
                      ) : null}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PortaledFloatingPanel>
      ) : null}
    </div>
  )
}

const chipClass =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-1.5 pr-2 text-xs font-semibold text-foreground hover:bg-muted/80 hover:text-foreground'

const sideChipClass =
  'grid size-9 shrink-0 place-items-center rounded-lg hover:brightness-95'

const sideChipExpandedClass =
  'flex h-9 w-full shrink-0 items-center gap-2 rounded-lg px-1.5 hover:bg-muted'

/** A top-bar app chip (or side-rail icon). With a menu: click opens the list. Without: go to the hub. */
function AppChipLink({
  app,
  current,
  hasMenu,
  open,
  triggerRef,
  onToggleMenu,
  onDone,
  children,
  variant = 'top',
  sideExpanded = false,
}: {
  app: LauncherApp
  current: boolean
  hasMenu: boolean
  open: boolean
  triggerRef?: RefObject<HTMLElement | null>
  onToggleMenu: () => void
  onDone: () => void
  children: ReactNode
  variant?: 'top' | 'side'
  sideExpanded?: boolean
}) {
  const side = variant === 'side'
  const activeClass = side
    ? sideExpanded
      ? (current || open) && 'bg-muted ring-1 ring-border'
      : (current || open) && 'ring-2 ring-foreground/25 ring-offset-1 ring-offset-background'
    : (current || open) &&
      'bg-card text-foreground shadow-sm ring-1 ring-border dark:text-foreground'
  const className = side
    ? cn(sideExpanded ? sideChipExpandedClass : sideChipClass, activeClass)
    : cn(chipClass, activeClass)
  // Side icon chips: wash tile + accent ink — keep accent dark enough to read.
  const sideStyle =
    side && !sideExpanded
      ? { backgroundColor: app.wash, color: readableAccent(app.accent, app.wash) }
      : undefined

  if (hasMenu) {
    return (
      <button
        ref={triggerRef as RefObject<HTMLButtonElement | null> | undefined}
        type="button"
        aria-current={current ? 'page' : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={app.label}
        title={side && !sideExpanded ? undefined : side ? app.label : `Open ${app.label} list`}
        onClick={onToggleMenu}
        className={className}
        style={sideStyle}
      >
        {children}
      </button>
    )
  }

  // Always the app’s front door — not a remembered deep page (e.g. Expenses).
  return (
    <Link
      ref={triggerRef as RefObject<HTMLAnchorElement | null> | undefined}
      href={app.href}
      aria-current={current ? 'page' : undefined}
      aria-label={app.label}
      title={side && !sideExpanded ? undefined : app.label}
      onClick={onDone}
      className={className}
      style={sideStyle}
    >
      {children}
    </Link>
  )
}

/**
 * Instant name to the right of a collapsed side-rail icon.
 * Portaled + fixed so the rail's overflow scroll cannot clip it.
 */
function SideIconTip({
  label,
  anchorRef,
}: {
  label: string
  anchorRef: RefObject<HTMLElement | null>
}) {
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const node = anchorRef.current
    if (!node) return

    const show = () => {
      const rect = node.getBoundingClientRect()
      setPlace({ top: rect.top + rect.height / 2, left: rect.right + 8 })
    }
    const hide = () => setPlace(null)

    node.addEventListener('pointerenter', show)
    node.addEventListener('pointerleave', hide)
    node.addEventListener('focus', show)
    node.addEventListener('blur', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      node.removeEventListener('pointerenter', show)
      node.removeEventListener('pointerleave', hide)
      node.removeEventListener('focus', show)
      node.removeEventListener('blur', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [anchorRef])

  if (!place || typeof document === 'undefined') return null

  return createPortal(
    <span
      role="tooltip"
      style={{ position: 'fixed', top: place.top, left: place.left, transform: 'translateY(-50%)' }}
      className="pointer-events-none z-[80] whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md ring-1 ring-black/5"
    >
      {label}
    </span>,
    document.body,
  )
}

/** One app in the Apps menu: primary click opens the front door. */
function AppsMenuRow({ app, onDone }: { app: LauncherApp; onDone: () => void }) {
  const Icon = ICONS[app.icon]
  const door = useAppDoor(app.key, app.href)
  return (
    <li className="flex items-stretch hover:bg-muted">
      <Link
        href={app.href}
        role="menuitem"
        onClick={onDone}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5"
      >
        {isAppGlyph(app.glyph) ? (
          <span className="app-glyph-tile grid size-7 shrink-0 place-items-center rounded-lg">
            <AppGlyph name={app.glyph} className="size-[1.125rem]" />
          </span>
        ) : (
          <span
            className="grid size-5 shrink-0 place-items-center rounded"
            style={{ backgroundColor: app.wash, color: app.accent }}
          >
            <Icon className="size-3" strokeWidth={2} aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-foreground">{app.label}</span>
          {app.blurb ? (
            <span className="block text-[0.65rem] leading-snug text-muted-foreground">
              {app.blurb}
            </span>
          ) : null}
        </span>
      </Link>
      {door.remembered && door.href !== app.href ? (
        <Link
          href={door.href}
          role="menuitem"
          onClick={() => {
            door.onClick()
            onDone()
          }}
          aria-label={`Continue ${app.label} where you left off`}
          title="Continue where you left off"
          className="grid w-9 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
        >
          <RotateCcwIcon className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </li>
  )
}

/** Clears every remembered place for this user in this browser. */
function ForgetPlacesRow({ onDone }: { onDone: () => void }) {
  const { remembersAnything, forgetAll } = useAppMemoryControls()
  if (!remembersAnything) return null
  return (
    <>
      <li className="my-1 border-t border-border" aria-hidden />
      <li>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            forgetAll()
            onDone()
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RotateCcwIcon className="size-3.5" aria-hidden />
          Start every app from the beginning
        </button>
      </li>
    </>
  )
}


