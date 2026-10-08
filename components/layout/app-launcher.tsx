'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AppGlyph, isAppGlyph, type AppGlyphName } from '@/components/layout/app-glyphs'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRightIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  MonitorIcon,
  BanknoteIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarRangeIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  ClockIcon,
  FileTextIcon,
  HandCoinsIcon,
  NotebookPenIcon,
  PackageIcon,
  PaletteIcon,
  PercentIcon,
  ReceiptIcon,
  ScaleIcon,
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { menuForApp } from './header-app-menus'
import { appsForPermissions, type LauncherIcon } from './launcher-apps'

const ICONS: Record<LauncherIcon, LucideIcon> = {
  receipt: ReceiptIcon,
  users: UsersIcon,
  'shopping-cart': ShoppingCartIcon,
  building: Building2Icon,
  wallet: WalletIcon,
  'hand-coins': HandCoinsIcon,
  package: PackageIcon,
  book: BookOpenIcon,
  notebook: NotebookPenIcon,
  trending: TrendingUpIcon,
  banknote: BanknoteIcon,
  calendar: CalendarRangeIcon,
  settings: SettingsIcon,
  help: CircleHelpIcon,
  scale: ScaleIcon,
  clock: ClockIcon,
  percent: PercentIcon,
  clipboard: ClipboardListIcon,
  sliders: SlidersHorizontalIcon,
  scroll: ScrollTextIcon,
  palette: PaletteIcon,
  file: FileTextIcon,
  transfer: ArrowLeftRightIcon,
  monitor: MonitorIcon,
}

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

/** Paths that belong to an app whose own door uses a different prefix. */
const APP_ALSO: Record<string, string[]> = {
  inventory: ['/items'],
  accounting: ['/accounts'],
}

function appIsCurrent(pathname: string, href: string, also: string[] = []) {
  const paths = [href, ...also]
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/**
 * The apps, in the top bar, so any screen can open one directly.
 *
 * Hovering a chip opens the destinations inside that app — Sales shows invoices
 * and receipts, Purchases shows Delivery — without first opening the hub.
 * Clicking Apps opens the full app list (works on touch where hover does not).
 */
export function HeaderApps({ permissions, hidden }: { permissions: string[]; hidden?: string[] }) {
  const pathname = usePathname()
  const apps = useMemo(() => {
    const all = appsForPermissions(permissions)
    return hidden && hidden.length > 0 ? all.filter((app) => !hidden.includes(app.key)) : all
  }, [permissions, hidden])
  const home = pathname === '/dashboard'
  const [openKey, setOpenKey] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  // Choosing a destination navigates in place; close the flyout so it does not
  // stay open over the new screen while the pointer is still on the chip.
  useEffect(() => {
    setOpenKey(null)
  }, [pathname])

  useEffect(() => {
    if (!openKey) return
    function onPointerDown(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (navRef.current?.contains(event.target)) return
      setOpenKey(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenKey(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openKey])

  const appsMenuOpen = openKey === '__apps__'

  return (
    <nav ref={navRef} aria-label="Apps" className="flex flex-wrap items-center gap-1">
      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={appsMenuOpen}
          aria-current={home ? 'page' : undefined}
          onClick={() => setOpenKey((key) => (key === '__apps__' ? null : '__apps__'))}
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground',
            (home || appsMenuOpen) && 'bg-card text-foreground shadow-sm ring-1 ring-border',
          )}
        >
          <LayoutGridIcon className="size-3.5 text-primary" aria-hidden />
          Apps
          <ChevronDownIcon
            className={cn('size-3 opacity-60 transition-transform', appsMenuOpen && 'rotate-180')}
            aria-hidden
          />
        </button>
        <div
          role="menu"
          aria-label="All apps"
          hidden={!appsMenuOpen}
          className={cn(
            'absolute left-0 top-full z-50 min-w-[14rem] pt-1.5',
            !appsMenuOpen && 'pointer-events-none',
          )}
        >
          <ul className="max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-border bg-popover py-1.5 text-popover-foreground shadow-[0_8px_28px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/5">
            <li>
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setOpenKey(null)}
                className="block px-3 py-1.5 text-xs font-semibold text-popover-foreground hover:bg-muted"
              >
                Apps home
              </Link>
            </li>
            <li className="my-1 border-t border-border" aria-hidden />
            {apps.map((app) => {
              const Icon = ICONS[app.icon]
              return (
                <li key={app.key}>
                  <Link
                    href={app.href}
                    role="menuitem"
                    onClick={() => setOpenKey(null)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted"
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
                      <span className="block text-xs font-medium text-popover-foreground">{app.label}</span>
                      {app.blurb ? (
                        <span className="block text-[0.65rem] leading-snug text-muted-foreground">
                          {app.blurb}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      {apps.map((app) => {
        const Icon = ICONS[app.icon]
        const current = appIsCurrent(pathname, app.href, APP_ALSO[app.key])
        const children = menuForApp(app.key, permissions)
        const open = openKey === app.key && children.length > 0
        return (
          <div
            key={app.key}
            className="relative"
            onMouseEnter={() => {
              if (children.length > 0) setOpenKey(app.key)
            }}
            onMouseLeave={() => setOpenKey((key) => (key === app.key ? null : key))}
          >
            <Link
              href={app.href}
              aria-current={current ? 'page' : undefined}
              aria-haspopup={children.length > 0 ? 'menu' : undefined}
              aria-expanded={children.length > 0 ? open : undefined}
              onClick={() => setOpenKey(null)}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground',
                current && 'bg-card text-foreground shadow-sm ring-1 ring-border',
              )}
            >
              <span
                className="grid size-4 place-items-center rounded"
                style={{ backgroundColor: app.wash, color: app.accent }}
              >
                <Icon className="size-3" strokeWidth={2} aria-hidden />
              </span>
              {app.label}
            </Link>
            {children.length > 0 ? (
              <div
                role="menu"
                aria-label={`${app.label} apps`}
                hidden={!open}
                className={cn(
                  'absolute left-0 top-full z-50 min-w-[13.5rem] pt-1.5',
                  !open && 'pointer-events-none',
                )}
              >
                <ul className="max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-border bg-popover py-1.5 text-popover-foreground shadow-[0_8px_28px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/5">
                  <li>
                    <Link
                      href={app.href}
                      role="menuitem"
                      onClick={() => setOpenKey(null)}
                      className="block px-3 py-1.5 text-xs font-semibold text-popover-foreground hover:bg-muted"
                    >
                      {app.label} home
                    </Link>
                  </li>
                  <li className="my-1 border-t border-border" aria-hidden />
                  {children.map((item) => (
                    <li key={`${app.key}-${item.href}-${item.label}`}>
                      <Link
                        href={item.href}
                        role="menuitem"
                        onClick={() => setOpenKey(null)}
                        className="block px-3 py-1.5 hover:bg-muted"
                      >
                        <span className="block text-xs font-medium text-popover-foreground">{item.label}</span>
                        {item.blurb ? (
                          <span className="block text-[0.65rem] leading-snug text-muted-foreground">
                            {item.blurb}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * Shared home / module switcher: white tiles, coloured marks, labels underneath.
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
}) {
  const [query, setQuery] = useState('')
  const needle = searchable ? query.trim().toLowerCase() : ''
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

  return (
    <div className="relative mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)] pb-16 pt-8 sm:pt-12 lg:pt-14">
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
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reports"
            aria-label="Search reports"
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-slate-900/10 placeholder:text-slate-400 focus:ring-2"
          />
        </div>
      ) : null}

      {banner ? <div className="mb-10">{banner}</div> : null}

      {insights && insights.length > 0 ? (
        <ul
          className="mb-10 grid gap-3 sm:grid-cols-3"
          style={{ animation: 'launcher-fade 700ms ease both' }}
        >
          {insights.map((insight) => {
            const body = (
              <>
                <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500">
                  {insight.label}
                </span>
                <span className="mt-1 block truncate text-lg font-semibold tabular text-slate-800">
                  {insight.value}
                </span>
                {insight.hint ? (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{insight.hint}</span>
                ) : null}
              </>
            )

            return (
              <li key={insight.label}>
                {insight.href ? (
                  <Link
                    href={insight.href}
                    className="block rounded-2xl bg-white/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-10px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-10px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {searchable && needle && shownSections.length === 0 && shownApps.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No report matches that search.</p>
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
      ) : (
        <TileGrid apps={shownApps} />
      )}
    </div>
  )
}

function TileGrid({ apps }: { apps: LauncherTile[] }) {
  return (
    <ul className="mx-auto grid max-w-3xl grid-cols-4 gap-x-3 gap-y-6 sm:max-w-4xl sm:grid-cols-5 sm:gap-x-5 sm:gap-y-8">
      {apps.map((app, index) => (
        <li
          key={app.key}
          style={{
            animation: `launcher-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both`,
            animationDelay: `${80 + index * 28}ms`,
          }}
        >
          <AppTile app={app} />
        </li>
      ))}
    </ul>
  )
}

function AppTile({ app }: { app: LauncherTile }) {
  const Icon = ICONS[app.icon]
  const glyph = isAppGlyph(app.glyph) ? app.glyph : null

  return (
    <Link
      href={app.href}
      className={cn(
        'group flex flex-col items-center gap-2.5 outline-none',
        'focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-4',
      )}
    >
      {glyph ? (
        <span
          data-glyph={glyph}
          className={cn(
            'app-glyph-tile grid size-[4.5rem] place-items-center rounded-[1.375rem] sm:size-[5.25rem]',
            'transition duration-200 ease-out group-hover:-translate-y-1 group-active:translate-y-0 group-active:scale-[0.98]',
          )}
        >
          <AppGlyph name={glyph} className="size-11 sm:size-[3.25rem]" />
        </span>
      ) : (
        <span
          className={cn(
            'grid size-[4.5rem] place-items-center rounded-2xl bg-white sm:size-[5.25rem]',
            'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-8px_rgba(15,23,42,0.12)]',
            'ring-1 ring-slate-900/5 transition duration-200 ease-out',
            'group-hover:-translate-y-1 group-hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_16px_28px_-10px_rgba(15,23,42,0.18)]',
            'group-active:translate-y-0 group-active:scale-[0.98]',
          )}
        >
          <span
            className="grid size-11 place-items-center rounded-xl sm:size-12"
            style={{ backgroundColor: app.wash, color: app.accent }}
          >
            <Icon className="size-6 sm:size-7" strokeWidth={1.75} aria-hidden />
          </span>
        </span>
      )}
      <span className="max-w-[7rem] text-center">
        <span className="block text-[0.8125rem] font-medium leading-snug text-foreground/85 transition-colors group-hover:text-foreground">
          {app.label}
        </span>
        {app.blurb ? (
          <span className="mt-0.5 hidden text-[0.6875rem] leading-snug text-muted-foreground sm:block">
            {app.blurb}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
