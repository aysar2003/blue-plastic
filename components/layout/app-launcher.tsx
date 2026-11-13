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
import { AppGlyph, isAppGlyph, type AppGlyphName } from '@/components/layout/app-glyphs'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  RotateCcwIcon,
  SearchIcon,
} from 'lucide-react'

import { PortaledFloatingPanel } from '@/components/ui/portaled-floating-panel'
import type { OrgFeatureFlags } from '@/lib/feature-flags'
import { cn } from '@/lib/utils'
import { AppDestinationsPanel, DestinationRow } from './app-destinations-panel'
import { menuForApp } from './header-app-menus'
import {
  APP_ALSO,
  appsForPermissions,
  groupLauncherApps,
  type LauncherApp,
  type LauncherFolder,
  type LauncherIcon,
} from './launcher-apps'
import { LAUNCHER_ICONS } from './launcher-icon-map'
import { useAppDoor, useAppMemoryControls } from './app-memory'
import { ReportsMenuPanel } from './reports-menu-panel'

const ICONS = LAUNCHER_ICONS

export type LauncherTile = {
  key: string
  label: string
  href: string
  icon: LauncherIcon
  /** When set, the tile is the dark app tile with this flat colour mark. */
  glyph?: AppGlyphName
  accent: string
  wash: string
  blurb?: string
}

export type LauncherInsight = {
  label: string
  value: string
  hint?: string
  href?: string
}

export type LauncherSection = {
  label: string
  blurb?: string
  apps: LauncherTile[]
}


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

/**
 * Shared home / module switcher: app tiles with labels underneath (near-black on
 * light themes, theme foreground on dark/ink/odoo-dark).
 *
 * When `grouped` is on (home Apps), related apps sit inside Odoo-style folders —
 * click a folder to enter it, then back to return.
 */
export function AppLauncher({
  eyebrow,
  title,
  subtitle,
  apps,
  sections,
  insights,
  searchable,
  banner,
  grouped = false,
  /** Odoo home menu: search + dense flat app grid (no folders, no welcome). */
  homeMenu = false,
  /** Opens the Apps manager (ON/OFF) — Odoo’s Apps app. */
  manageAppsHref,
}: {
  eyebrow: string
  title: string
  subtitle: string
  apps?: LauncherTile[]
  sections?: LauncherSection[]
  insights?: LauncherInsight[]
  /** A box that finds a section or a tile by its name. */
  searchable?: boolean
  /** Drawn under the search, above the grouped tiles. */
  banner?: ReactNode
  /** Optional folder tiles that drill into related apps. */
  grouped?: boolean
  homeMenu?: boolean
  manageAppsHref?: string
}) {
  const [query, setQuery] = useState('')
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const needle = searchable || homeMenu || grouped ? query.trim().toLowerCase() : ''
  const shownSections = (sections ?? [])
    .map((section) => ({
      ...section,
      apps: section.apps.filter((app) =>
        !needle || `${section.label} ${section.blurb ?? ''} ${app.label} ${app.blurb ?? ''}`.toLowerCase().includes(needle),
      ),
    }))
    .filter((section) => section.apps.length > 0)
  const shownApps = (apps ?? []).filter(
    (app) => !needle || `${app.label} ${app.blurb ?? ''}`.toLowerCase().includes(needle),
  )

  const folderModel = useMemo(() => {
    if (!grouped || homeMenu || !apps || apps.length === 0 || (sections && sections.length > 0)) return null
    return groupLauncherApps(apps as LauncherApp[])
  }, [grouped, homeMenu, apps, sections])

  const openFolder =
    folderModel && openFolderId
      ? folderModel.folders.find((folder) => folder.id === openFolderId) ?? null
      : null

  const folderSearchHits = useMemo(() => {
    if (!folderModel || !needle) return null
    const hits: LauncherTile[] = []
    const seen = new Set<string>()
    for (const app of [...folderModel.loose, ...folderModel.folders.flatMap((f) => f.apps)]) {
      if (seen.has(app.key)) continue
      const hay = `${app.label} ${app.blurb ?? ''}`.toLowerCase()
      if (!hay.includes(needle)) continue
      seen.add(app.key)
      hits.push(app)
    }
    return hits
  }, [folderModel, needle])

  const odooHome = homeMenu || Boolean(folderModel)

  return (
    <div
      data-odoo-home={odooHome ? 'true' : undefined}
      className={cn(
        'relative mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)]',
        odooHome
          ? 'odoo-home-menu flex min-h-[calc(100svh-7rem)] flex-col pb-10 pt-6 sm:pt-8'
          : 'pb-16 pt-8 sm:pt-12 lg:pt-14',
      )}
    >
      {odooHome ? (
        <div className="relative mx-auto mb-8 w-full max-w-xl sm:mb-10">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              if (event.target.value.trim()) setOpenFolderId(null)
            }}
            placeholder="Search apps…"
            aria-label="Search apps"
            className="odoo-home-search w-full rounded-lg border border-border/80 bg-card py-2.5 pl-10 pr-3 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      ) : (
        <>
          <div className="mb-8 text-center sm:mb-10">
            <p
              className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              style={{ animation: 'launcher-fade 480ms ease both' }}
            >
              {eyebrow}
            </p>
            <h1
              className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
              style={{ animation: 'launcher-fade 560ms ease both' }}
            >
              {title}
            </h1>
            <p
              className="mx-auto mt-2 max-w-md text-sm text-muted-foreground"
              style={{ animation: 'launcher-fade 640ms ease both' }}
            >
              {subtitle}
            </p>
          </div>

          {searchable ? (
            <div className="relative mx-auto mb-8 w-full max-w-md">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search reports"
                aria-label="Search reports"
                className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none ring-foreground/10 placeholder:text-muted-foreground focus:ring-2"
              />
            </div>
          ) : null}
        </>
      )}

      {banner ? <div className="mb-10">{banner}</div> : null}

      {insights && insights.length > 0 && !odooHome ? (
        <ul
          className="mb-10 grid gap-3 sm:grid-cols-3"
          style={{ animation: 'launcher-fade 700ms ease both' }}
        >
          {insights.map((insight) => {
            const body = (
              <>
                <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {insight.label}
                </span>
                <span className="mt-1 block truncate text-lg font-semibold tabular text-foreground">
                  {insight.value}
                </span>
                {insight.hint ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{insight.hint}</span>
                ) : null}
              </>
            )

            return (
              <li key={insight.label}>
                {insight.href ? (
                  <Link
                    href={insight.href}
                    className="block rounded-2xl bg-card/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-10px_rgba(15,23,42,0.12)] ring-1 ring-foreground/5 transition hover:-translate-y-0.5 hover:bg-card"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="rounded-2xl bg-card/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-10px_rgba(15,23,42,0.12)] ring-1 ring-foreground/5">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {searchable && needle && shownSections.length === 0 && shownApps.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No report matches that search.</p>
      ) : null}

      {(folderModel || homeMenu) && needle && shownApps.length === 0 && (!folderSearchHits || folderSearchHits.length === 0) ? (
        <p className="text-center text-sm text-muted-foreground">No app matches that search.</p>
      ) : null}

      {sections && sections.length > 0 ? (
        <div className="space-y-12">
          {shownSections.map((section) => (
            <section key={section.label}>
              <h2 className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </h2>
              {section.blurb ? (
                <p className="mx-auto mt-1 max-w-md text-center text-sm text-muted-foreground">{section.blurb}</p>
              ) : null}
              <div className="mt-6">
                <TileGrid apps={section.apps} />
              </div>
            </section>
          ))}
        </div>
      ) : homeMenu ? (
        <div className="odoo-home-stage mx-auto w-full max-w-5xl rounded-2xl px-2 py-2 sm:px-4 sm:py-4 lg:max-w-6xl">
          <TileGrid
            apps={
              manageAppsHref && !needle
                ? [
                    ...shownApps.filter((app) => app.key !== 'settings' && app.key !== 'help'),
                    {
                      key: 'apps-manager',
                      label: 'Apps',
                      href: manageAppsHref,
                      icon: 'sliders' as LauncherIcon,
                      glyph: 'settings',
                      accent: '#714B67',
                      wash: '#EDE9FE',
                      blurb: 'Turn apps on or off',
                    },
                    ...shownApps.filter((app) => app.key === 'settings' || app.key === 'help'),
                  ]
                : shownApps
            }
            odoo
          />
        </div>
      ) : folderModel && folderSearchHits ? (
        <TileGrid apps={folderSearchHits} odoo />
      ) : folderModel && openFolder ? (
        <FolderOverlay folder={openFolder} onBack={() => setOpenFolderId(null)} />
      ) : folderModel ? (
        <FolderHome
          folders={folderModel.folders}
          loose={folderModel.loose}
          onOpenFolder={setOpenFolderId}
        />
      ) : (
        <TileGrid apps={shownApps} />
      )}
    </div>
  )
}

const ODOO_GRID =
  'mx-auto grid w-full max-w-5xl grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-7 md:grid-cols-6 lg:max-w-6xl lg:grid-cols-8'

function FolderHome({
  folders,
  loose,
  onOpenFolder,
}: {
  folders: LauncherFolder[]
  loose: LauncherApp[]
  onOpenFolder: (id: string) => void
}) {
  const items: Array<{ kind: 'folder'; folder: LauncherFolder } | { kind: 'app'; app: LauncherTile }> = [
    ...folders.map((folder) => ({ kind: 'folder' as const, folder })),
    ...loose.map((app) => ({ kind: 'app' as const, app })),
  ]

  return (
    <ul data-app-nav className={ODOO_GRID}>
      {items.map((item, index) => (
        <li
          key={item.kind === 'folder' ? `folder-${item.folder.id}` : item.app.key}
          style={{
            animation: `launcher-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both`,
            animationDelay: `${40 + index * 20}ms`,
          }}
        >
          {item.kind === 'folder' ? (
            <FolderTile folder={item.folder} onOpen={() => onOpenFolder(item.folder.id)} />
          ) : (
            <AppTile app={item.app} odoo />
          )}
        </li>
      ))}
    </ul>
  )
}

/** Odoo-style folder sheet: dim the grid and open apps in a centred panel. */
function FolderOverlay({ folder, onBack }: { folder: LauncherFolder; onBack: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close folder"
        onClick={onBack}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={folder.label}
        className="odoo-folder-panel relative z-10 w-full max-w-2xl rounded-2xl border border-border/60 bg-card p-5 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] sm:p-7"
      >
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Back to all apps"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{folder.label}</h2>
            <p className="truncate text-xs text-muted-foreground">{folder.blurb}</p>
          </div>
        </div>
        <TileGrid apps={folder.apps} odoo />
      </div>
    </div>
  )
}

function FolderTile({ folder, onOpen }: { folder: LauncherFolder; onOpen: () => void }) {
  const preview = folder.apps.slice(0, 4)

  return (
    <button
      type="button"
      onClick={onOpen}
      title={folder.label}
      aria-label={`Open ${folder.label} folder, ${folder.apps.length} apps`}
      className={cn(
        'group flex w-full flex-col items-center gap-2 outline-none',
        'focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
      )}
    >
      <span
        className={cn(
          'odoo-home-tile grid size-[4.5rem] grid-cols-2 gap-1 rounded-xl p-1.5 sm:size-[5rem]',
          'bg-card shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-border/70',
          'transition duration-150 ease-out group-hover:-translate-y-0.5 group-hover:shadow-md group-active:translate-y-0 group-active:scale-[0.98]',
        )}
      >
        {preview.map((app) => {
          const glyph = isAppGlyph(app.glyph) ? app.glyph : null
          return (
            <span
              key={app.key}
              className="grid size-full place-items-center overflow-hidden rounded-md"
              style={{ backgroundColor: app.wash }}
            >
              {glyph ? (
                <AppGlyph name={glyph} className="size-4 sm:size-[1.15rem]" />
              ) : (
                <span className="size-1.5 rounded-full" style={{ backgroundColor: app.accent }} />
              )}
            </span>
          )
        })}
        {Array.from({ length: Math.max(0, 4 - preview.length) }).map((_, i) => (
          <span key={`empty-${i}`} className="size-full rounded-md bg-muted/60" aria-hidden />
        ))}
      </span>
      <span className="max-w-[7rem] text-center text-[0.75rem] font-medium leading-snug text-foreground sm:text-[0.8125rem]">
        {folder.label}
      </span>
    </button>
  )
}

function TileGrid({ apps, odoo = false }: { apps: LauncherTile[]; odoo?: boolean }) {
  return (
    <ul
      data-app-nav
      className={
        odoo
          ? ODOO_GRID
          : 'mx-auto grid max-w-3xl grid-cols-4 gap-x-3 gap-y-6 sm:max-w-4xl sm:grid-cols-5 sm:gap-x-5 sm:gap-y-8'
      }
    >
      {apps.map((app, index) => (
        <li
          key={app.key}
          style={{
            animation: `launcher-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both`,
            animationDelay: `${40 + index * 20}ms`,
          }}
        >
          <AppTile app={app} odoo={odoo} />
        </li>
      ))}
    </ul>
  )
}

function AppTile({ app, odoo = false }: { app: LauncherTile; odoo?: boolean }) {
  const Icon = ICONS[app.icon]
  const glyph = isAppGlyph(app.glyph) ? app.glyph : null

  return (
    <Link
      href={app.href}
      title={app.label}
      className={cn(
        'group flex flex-col items-center outline-none',
        odoo ? 'gap-2' : 'gap-2.5',
        'focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
      )}
    >
      {glyph ? (
        <span
          data-glyph={glyph}
          className={cn(
            'app-glyph-tile grid place-items-center',
            odoo
              ? 'odoo-home-tile size-[4.5rem] rounded-xl sm:size-[5rem]'
              : 'size-[4.5rem] rounded-[1.375rem] sm:size-[5.25rem]',
            'transition duration-150 ease-out group-hover:-translate-y-0.5 group-active:translate-y-0 group-active:scale-[0.98]',
          )}
        >
          <AppGlyph name={glyph} className={odoo ? 'size-9 sm:size-10' : 'size-11 sm:size-[3.25rem]'} />
        </span>
      ) : (
        <span
          className={cn(
            'grid place-items-center bg-card',
            odoo
              ? 'odoo-home-tile size-[4.5rem] rounded-xl sm:size-[5rem]'
              : 'size-[4.5rem] rounded-2xl sm:size-[5.25rem]',
            'shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-border/70 transition duration-150 ease-out',
            'group-hover:-translate-y-0.5 group-hover:shadow-md',
            'group-active:translate-y-0 group-active:scale-[0.98]',
          )}
        >
          <span
            className={cn('grid place-items-center rounded-lg', odoo ? 'size-9 sm:size-10' : 'size-11 sm:size-12')}
            style={{ backgroundColor: app.wash, color: app.accent }}
          >
            <Icon className={odoo ? 'size-5 sm:size-6' : 'size-6 sm:size-7'} strokeWidth={1.75} aria-hidden />
          </span>
        </span>
      )}
      <span className={cn('text-center', odoo ? 'max-w-[7rem]' : 'max-w-[7rem]')}>
        <span
          className={cn(
            'block leading-snug',
            odoo
              ? 'text-[0.75rem] font-medium text-foreground sm:text-[0.8125rem]'
              : 'text-[0.8125rem] font-semibold text-foreground',
          )}
        >
          {app.label}
        </span>
        {!odoo && app.blurb ? (
          <span className="mt-0.5 hidden text-[0.6875rem] font-medium leading-snug text-muted-foreground sm:block">
            {app.blurb}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
