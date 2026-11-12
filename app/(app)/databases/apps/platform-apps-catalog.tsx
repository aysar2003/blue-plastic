'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2Icon, SearchIcon, ShieldIcon } from 'lucide-react'

import { AppGlyph, isAppGlyph } from '@/components/layout/app-glyphs'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ModuleFlag } from '@/lib/feature-flags'
import {
  APP_CATALOG_CATEGORIES,
  type AppCatalogCategoryId,
  type PlatformCatalogApp,
} from '@/lib/platform-apps-catalog'
import { cn } from '@/lib/utils'

import { PendingAppRequests, type PendingAppRequestRow } from '../pending-app-requests'
import { GrantModuleButton } from './grant-module-button'

type CompanyGrant = {
  id: string
  name: string
  grantedLabels: string[]
  grantedCount: number
}

type MissingCompany = { id: string; name: string }

export function PlatformAppsCatalog({
  apps,
  grantCounts,
  companyTotal,
  missingByModule,
  companies,
  pendingRequests,
  timeZone,
}: {
  apps: PlatformCatalogApp[]
  grantCounts: Record<string, number>
  companyTotal: number
  missingByModule: Record<ModuleFlag, MissingCompany[]>
  companies: CompanyGrant[]
  pendingRequests: PendingAppRequestRow[]
  timeZone: string
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<AppCatalogCategoryId>('all')
  const [view, setView] = useState<'catalog' | 'companies'>('catalog')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return apps.filter((app) => {
      if (category !== 'all' && app.category !== category) return false
      if (!needle) return true
      return `${app.label} ${app.hint} ${app.categoryLabel}`.toLowerCase().includes(needle)
    })
  }, [apps, category, query])

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(APP_CATALOG_CATEGORIES.map((row) => [row.id, 0])) as Record<
      AppCatalogCategoryId,
      number
    >
    counts.all = apps.length
    for (const app of apps) counts[app.category] += 1
    return counts
  }, [apps])

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-indigo-500/15 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm">
        <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:py-7">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-indigo-200/90">
              App store
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Apps</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-indigo-100/85">
              Browse every module this installation can grant. Companies only open what you grant
              here — create, Limits, or approve a request. They can still turn granted apps off under
              Settings → Apps & features.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
              <p className="text-[0.65rem] uppercase tracking-wide text-indigo-200/80">Modules</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{apps.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
              <p className="text-[0.65rem] uppercase tracking-wide text-indigo-200/80">Companies</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{companyTotal}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
              <p className="text-[0.65rem] uppercase tracking-wide text-indigo-200/80">Requests</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{pendingRequests.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div id="pending-apps" className="scroll-mt-6">
        <PendingAppRequests timeZone={timeZone} requests={pendingRequests} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm">
          <ViewTab active={view === 'catalog'} onClick={() => setView('catalog')}>
            Catalog
          </ViewTab>
          <ViewTab active={view === 'companies'} onClick={() => setView('companies')}>
            By company
          </ViewTab>
        </div>

        {view === 'catalog' ? (
          <div className="relative w-full sm:max-w-sm">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search apps…"
              aria-label="Search apps"
              className="pl-9"
            />
          </div>
        ) : (
          <Link
            href="/databases"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
          >
            All companies
          </Link>
        )}
      </div>

      {view === 'catalog' ? (
        <div className="grid gap-5 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <aside className="space-y-1 lg:sticky lg:top-4 lg:self-start">
            <p className="px-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Categories
            </p>
            {APP_CATALOG_CATEGORIES.map((row) => {
              const active = category === row.id
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setCategory(row.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-indigo-500/10 font-medium text-indigo-900 ring-1 ring-indigo-500/25 dark:text-indigo-100'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums text-xs opacity-70">{categoryCounts[row.id]}</span>
                </button>
              )
            })}
          </aside>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight">
                {category === 'all'
                  ? 'All apps'
                  : APP_CATALOG_CATEGORIES.find((row) => row.id === category)?.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {filtered.length} app{filtered.length === 1 ? '' : 's'}
              </p>
            </div>

            {filtered.length === 0 ? (
              <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
                No apps match that search.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((app) => {
                  const granted = grantCounts[app.key] ?? 0
                  const missing = missingByModule[app.key] ?? []
                  const coverage =
                    companyTotal === 0 ? 0 : Math.round((granted / companyTotal) * 100)
                  const missingPreview = missing.slice(0, 3)
                  const extraMissing = Math.max(0, missing.length - missingPreview.length)
                  return (
                    <article
                      key={app.key}
                      className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-colors hover:border-indigo-500/30 hover:bg-muted/20"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="grid size-12 shrink-0 place-items-center rounded-xl ring-1 ring-black/5"
                          style={{ backgroundColor: app.wash }}
                        >
                          {app.glyph && isAppGlyph(app.glyph) ? (
                            <AppGlyph name={app.glyph} className="size-8" />
                          ) : (
                            <Building2Icon className="size-5" style={{ color: app.accent }} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-sm font-semibold text-foreground">{app.label}</h3>
                            {app.optIn ? <Badge variant="outline">Opt-in</Badge> : null}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{app.categoryLabel}</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {app.hint}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto space-y-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span>
                              <span className="font-medium text-foreground">{granted}</span> of{' '}
                              {companyTotal} companies
                            </span>
                            <span className="tabular-nums">{coverage}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-indigo-500/80 transition-[width]"
                              style={{ width: `${coverage}%` }}
                            />
                          </div>
                        </div>

                        {missing.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              Missing:{' '}
                              <span className="text-foreground">
                                {missingPreview.map((row) => row.name).join(', ')}
                                {extraMissing > 0 ? ` +${extraMissing} more` : ''}
                              </span>
                            </p>
                            <GrantModuleButton
                              module={app.key}
                              label={app.label}
                              missingCount={missing.length}
                              optIn={app.optIn}
                            />
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Granted to every company.</p>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Company grants</h2>
            <p className="text-xs text-muted-foreground">
              Open Limits to add or remove apps for one company.
            </p>
          </div>

          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Granted apps</TableHead>
                  <TableHead className="w-[7rem]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="align-top font-medium">{company.name}</TableCell>
                    <TableCell className="align-top">
                      {company.grantedLabels.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No apps granted</span>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            {company.grantedCount} app{company.grantedCount === 1 ? '' : 's'}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {company.grantedLabels.map((label) => (
                              <Badge key={label} variant="secondary">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <Link
                        href={`/databases?limits=${company.id}`}
                        className={cn(
                          buttonVariants({ size: 'sm', variant: 'outline' }),
                          'inline-flex items-center gap-1.5',
                        )}
                      >
                        <ShieldIcon className="size-3.5" aria-hidden />
                        Limits
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}
    </div>
  )
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
