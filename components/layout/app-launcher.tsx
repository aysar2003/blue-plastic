'use client'

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { AppGlyph, isAppGlyph } from '@/components/layout/app-glyphs'
import {
  ArrowLeftIcon,
  SearchIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  groupLauncherApps,
  type LauncherApp,
  type LauncherFolder,
  type LauncherIcon,
} from './launcher-apps'
import { LAUNCHER_ICONS } from './launcher-icon-map'
import type { LauncherInsight, LauncherSection, LauncherTile } from './launcher-types'

export type { LauncherInsight, LauncherSection, LauncherTile } from './launcher-types'
export { HeaderApps } from './header-apps'

const ICONS = LAUNCHER_ICONS

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
        <div className="odoo-home-stage mx-auto w-full max-w-3xl rounded-2xl px-2 py-2 sm:max-w-4xl sm:px-4 sm:py-4">
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

/** Fixed 5-wide home grid (phone-style 5×N). Narrow screens stay 3 / 4 until sm. */
const ODOO_GRID =
  'mx-auto grid w-full max-w-3xl grid-cols-3 gap-x-3 gap-y-6 sm:max-w-4xl sm:grid-cols-5 sm:gap-x-5 sm:gap-y-8'

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
              className="app-chroma-chip grid size-full place-items-center overflow-hidden rounded-md"
              style={{ backgroundColor: app.wash }}
            >
              {glyph ? (
                <AppGlyph name={glyph} className="size-4 sm:size-[1.15rem]" />
              ) : (
                <span
                  className="app-chroma-dot size-1.5 rounded-full"
                  style={{ backgroundColor: app.accent }}
                />
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
            className={cn(
              'app-chroma-chip grid place-items-center rounded-lg',
              odoo ? 'size-9 sm:size-10' : 'size-11 sm:size-12',
            )}
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

