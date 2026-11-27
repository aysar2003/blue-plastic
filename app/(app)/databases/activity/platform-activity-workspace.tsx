'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ActivityIcon,
  AlertTriangleIcon,
  Building2Icon,
  DownloadIcon,
  HardDriveIcon,
  SearchIcon,
  ShieldAlertIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react'

import { PerformancePeriodPicker } from '@/components/performance-period-picker'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  PERFORMANCE_BAND_LABEL,
  isAllPerformanceDays,
  performancePeriodLabel,
  performancePeriodShortLabel,
  type PerformanceBand,
  type PerformancePeriodDays,
} from '@/lib/user-performance'
import { cn } from '@/lib/utils'

export type NamedCountView = { key: string; label: string; count: number }
export type DailyVolumeView = {
  day: string
  events: number
  work: number
  logins: number
  failedLogins: number
  activeUsers: number
  activeCompanies: number
}
export type PlatformActivityCompany = {
  orgId: string
  name: string
  sizeBytes: number
  activeUsers: number
  maxUsers: number | null
  seatUtilizationPct: number | null
  auditEvents: number
  prevAuditEvents: number
  eventsDeltaPct: number | null
  workEvents: number
  logins: number
  failedLogins: number
  uniqueActors: number
  customers: number
  vendors: number
  items: number
  salesDocs: number
  purchaseDocs: number
  modulesOn: number
  lastActiveLabel: string
  openBlocked: boolean
  rentExpired: boolean
  onTrial: boolean
  daysLeft: number | null
  quiet: boolean
  activityDrop: boolean
  riskFlags: string[]
}
export type PlatformActivityUser = {
  userId: string
  name: string
  email: string
  score: number
  band: PerformanceBand
  rank: number
  activeDays: number
  workActions: number
  eventCount: number
  companyNames: string[]
  companyCount: number
  twoFactorOn: boolean
  counts: {
    created: number
    updated: number
    posted: number
    approved: number
    logins: number
    failedLogins: number
  }
  topActionLabel: string | null
  lastActiveLabel: string
}
export type PlatformActivityEventRow = {
  id: string
  atLabel: string
  action: string
  actionLabel: string
  entityLabel: string
  detail: string | null
  actorId: string | null
  actorName: string
  orgId: string
  orgName: string
  ipAddress: string | null
}
export type PlatformActivityTotalsView = {
  companies: number
  activeStaff: number
  totalSizeBytes: number
  auditEvents: number
}
export type PlatformActivityInsightsView = {
  quietCompanies: number
  activeCompanies: number
  uniqueActors: number
  workEvents: number
  loginEvents: number
  failedLogins: number
  busiestCompanyName: string | null
  busiestCompanyEvents: number
  heaviestCompanyName: string | null
  heaviestCompanyBytes: number
  topUserName: string | null
  topUserScore: number
  previousPeriodEvents: number
  eventsDeltaPct: number | null
  bandCounts: Record<PerformanceBand, number>
  newCompanies: number
  newUsers: number
  twoFactorOn: number
  twoFactorOff: number
  twoFactorPct: number
  avgDailyActiveUsers: number
  peakDailyActiveUsers: number
  activityDropCompanies: number
  suspiciousIpCount: number
}
export type FeatureAdoptionView = {
  key: string
  label: string
  companiesOn: number
  pct: number
}
export type SuspiciousIpView = {
  ipAddress: string
  failedCount: number
  companyNames: string[]
  lastAtLabel: string
}
export type AttentionView = {
  kind: 'company' | 'security'
  severity: 'high' | 'medium'
  title: string
  detail: string
  href: string
}

type TabId = 'overview' | 'companies' | 'people' | 'security' | 'adoption' | 'feed'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function bandClass(band: PerformanceBand): string {
  switch (band) {
    case 'top':
      return 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300'
    case 'steady':
      return 'bg-primary/15 text-primary ring-primary/25'
    case 'low':
      return 'bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:text-amber-200'
    case 'inactive':
      return 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300'
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function barWidth(value: number, max: number): string {
  if (max <= 0) return '0%'
  return `${Math.max(3, Math.round((value / max) * 100))}%`
}

function shortDay(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`))
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) lines.push(row.map(escape).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function Panel({
  title,
  hint,
  children,
  action,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-[#0c1018]/80">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
        <div>
          <h2 className="text-[0.7rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
            {title}
          </h2>
          {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function PlatformActivityWorkspace({
  days,
  totals,
  insights,
  daily,
  actionMix,
  entityMix,
  featureAdoption,
  suspiciousIps,
  attention,
  companies,
  users,
  events,
}: {
  days: PerformancePeriodDays
  totals: PlatformActivityTotalsView
  insights: PlatformActivityInsightsView
  daily: DailyVolumeView[]
  actionMix: NamedCountView[]
  entityMix: NamedCountView[]
  featureAdoption: FeatureAdoptionView[]
  suspiciousIps: SuspiciousIpView[]
  attention: AttentionView[]
  companies: PlatformActivityCompany[]
  users: PlatformActivityUser[]
  events: PlatformActivityEventRow[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabId | null) ?? 'overview'
  const [tab, setTab] = useState<TabId>(
    ['overview', 'companies', 'people', 'security', 'adoption', 'feed'].includes(initialTab)
      ? initialTab
      : 'overview',
  )
  const [query, setQuery] = useState('')
  const [companySort, setCompanySort] = useState<'size' | 'events' | 'risk'>('size')
  const [feedFilter, setFeedFilter] = useState<'all' | 'security' | 'work'>('all')

  const maxSize = Math.max(0, ...companies.map((c) => c.sizeBytes))
  const maxScore = Math.max(0, ...users.map((u) => u.score))
  const maxDaily = Math.max(1, ...daily.map((d) => d.events))
  const maxAction = Math.max(1, ...actionMix.map((a) => a.count))
  const maxEntity = Math.max(1, ...entityMix.map((a) => a.count))
  const maxAdoption = 100

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = companies
    if (q) {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.riskFlags.some((f) => f.toLowerCase().includes(q)),
      )
    }
    if (companySort === 'events') {
      rows = [...rows].sort((a, b) => b.auditEvents - a.auditEvents || b.sizeBytes - a.sizeBytes)
    } else if (companySort === 'risk') {
      rows = [...rows].sort(
        (a, b) => b.riskFlags.length - a.riskFlags.length || b.failedLogins - a.failedLogins,
      )
    } else {
      rows = [...rows].sort((a, b) => b.sizeBytes - a.sizeBytes || b.auditEvents - a.auditEvents)
    }
    return rows
  }, [companies, query, companySort])

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.companyNames.some((c) => c.toLowerCase().includes(q)),
    )
  }, [users, query])

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (feedFilter === 'security' && e.action !== 'LOGIN_FAILED' && e.action !== 'LOGIN') {
        return false
      }
      if (
        feedFilter === 'work' &&
        (e.action === 'LOGIN' || e.action === 'LOGIN_FAILED' || e.action === 'LOGOUT')
      ) {
        return false
      }
      if (!q) return true
      return (
        e.actorName.toLowerCase().includes(q) ||
        e.orgName.toLowerCase().includes(q) ||
        e.actionLabel.toLowerCase().includes(q) ||
        e.entityLabel.toLowerCase().includes(q) ||
        (e.ipAddress?.toLowerCase().includes(q) ?? false) ||
        (e.detail?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [events, query, feedFilter])

  function setDays(nextDays: PerformancePeriodDays) {
    const next = new URLSearchParams(searchParams.toString())
    if (nextDays === 30) next.delete('days')
    else if (nextDays === 0) next.set('days', 'all')
    else next.set('days', String(nextDays))
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }

  function goTab(next: TabId) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'overview') params.delete('tab')
    else params.set('tab', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const delta = insights.eventsDeltaPct
  const DeltaIcon = delta != null && delta < 0 ? TrendingDownIcon : TrendingUpIcon

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, people, IPs, or events"
            className="h-10 w-full rounded-xl border border-slate-200/80 bg-white/90 pr-3 pl-9 text-sm outline-none ring-primary/30 focus:ring-2 dark:border-white/10 dark:bg-[#0c1018]/80"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              downloadCsv(
                `platform-companies-${isAllPerformanceDays(days) ? 'all' : `${days}d`}.csv`,
                [
                  'Company',
                  'SizeBytes',
                  'Users',
                  'MaxUsers',
                  'Events',
                  'PrevEvents',
                  'Work',
                  'FailedLogins',
                  'Risk',
                ],
                companies.map((c) => [
                  c.name,
                  String(c.sizeBytes),
                  String(c.activeUsers),
                  c.maxUsers == null ? '' : String(c.maxUsers),
                  String(c.auditEvents),
                  String(c.prevAuditEvents),
                  String(c.workEvents),
                  String(c.failedLogins),
                  c.riskFlags.join('|'),
                ]),
              )
            }
          >
            <DownloadIcon className="size-3.5" />
            Export CSV
          </Button>
          <PerformancePeriodPicker days={days} onChange={setDays} tone="indigo" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Companies',
            value: String(totals.companies),
            sub: `${insights.activeCompanies} active · ${insights.newCompanies} new`,
            icon: Building2Icon,
          },
          {
            label: 'People in motion',
            value: String(insights.uniqueActors),
            sub: `DAU avg ${insights.avgDailyActiveUsers} · peak ${insights.peakDailyActiveUsers}`,
            icon: UsersIcon,
          },
          {
            label: 'Data in use',
            value: formatBytes(totals.totalSizeBytes),
            sub: insights.heaviestCompanyName
              ? `Heaviest · ${insights.heaviestCompanyName}`
              : 'Estimated from row volume',
            icon: HardDriveIcon,
          },
          {
            label: `Events · ${performancePeriodShortLabel(days)}`,
            value: String(totals.auditEvents),
            sub:
              delta == null
                ? `Prior · ${insights.previousPeriodEvents}`
                : isAllPerformanceDays(days)
                  ? 'All recorded history'
                  : `${delta >= 0 ? '+' : ''}${delta}% vs prior ${days}d`,
            icon: ActivityIcon,
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1018]/80"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  {stat.label}
                </p>
                <Icon className="size-4 text-primary/80" aria-hidden />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
                {stat.value}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                {stat.label.startsWith('Events') && delta != null ? (
                  <DeltaIcon
                    className={cn(
                      'size-3.5',
                      delta < 0 ? 'text-amber-600' : 'text-emerald-600',
                    )}
                  />
                ) : null}
                {stat.sub}
              </p>
            </div>
          )
        })}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/70 p-1 dark:border-white/10 dark:bg-white/5">
        {(
          [
            { id: 'overview' as const, label: 'Overview' },
            { id: 'companies' as const, label: `Companies (${companies.length})` },
            { id: 'people' as const, label: `People (${users.length})` },
            { id: 'security' as const, label: `Security (${insights.suspiciousIpCount})` },
            { id: 'adoption' as const, label: 'Apps adoption' },
            { id: 'feed' as const, label: `Feed (${events.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => goTab(item.id)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
              tab === item.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-[#0c1018]/80">
              <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Work recorded
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{insights.workEvents}</p>
              <p className="mt-1 text-xs text-slate-500">Creates, posts, approvals, changes</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-[#0c1018]/80">
              <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                New this period
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {insights.newCompanies}
                <span className="text-sm font-medium text-slate-500"> cos · </span>
                {insights.newUsers}
                <span className="text-sm font-medium text-slate-500"> users</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">Created in the last {days} days</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-[#0c1018]/80">
              <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                2FA coverage
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{insights.twoFactorPct}%</p>
              <p className="mt-1 text-xs text-slate-500">
                {insights.twoFactorOn} on · {insights.twoFactorOff} off
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-[#0c1018]/80">
              <div className="flex items-center justify-between">
                <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Needs attention
                </p>
                <AlertTriangleIcon className="size-4 text-amber-600" />
              </div>
              <p className="mt-2 text-xl font-semibold tabular-nums">{attention.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                {insights.activityDropCompanies} activity drops · {insights.suspiciousIpCount} IPs
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <Panel
              title="Daily volume"
              hint={`Events + daily active users · ${performancePeriodLabel(days)}`}
            >
              <div className="flex h-40 items-end gap-1">
                {daily.map((point) => (
                  <div
                    key={point.day}
                    className="group relative flex min-w-0 flex-1 flex-col justify-end"
                  >
                    <div
                      className="w-full rounded-t-sm bg-primary/80 transition-all group-hover:bg-primary"
                      style={{ height: `${Math.max(4, (point.events / maxDaily) * 100)}%` }}
                      title={`${point.day}: ${point.events} events · ${point.activeUsers} DAU · ${point.activeCompanies} companies`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[0.65rem] text-slate-500">
                <span>{daily[0] ? shortDay(daily[0].day) : ''}</span>
                <span>{daily.at(-1) ? shortDay(daily.at(-1)!.day) : ''}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>Work {insights.workEvents}</span>
                <span>Sign-ins {insights.loginEvents}</span>
                <span>Failed {insights.failedLogins}</span>
                <span>Avg DAU {insights.avgDailyActiveUsers}</span>
              </div>
            </Panel>

            <Panel
              title="Attention queue"
              hint="Risk signals across tenants (quiet, rent, drops, failed sign-ins)"
              action={
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => goTab('security')}
                >
                  Security
                </button>
              }
            >
              {attention.length === 0 ? (
                <p className="text-sm text-slate-500">No risk signals in this period.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {attention.map((item) => (
                    <li key={`${item.kind}-${item.title}-${item.detail}`}>
                      <Link
                        href={item.href}
                        className={cn(
                          'block rounded-xl border px-3 py-2.5 transition-colors hover:bg-primary/5',
                          item.severity === 'high'
                            ? 'border-amber-500/30 bg-amber-500/10'
                            : 'border-slate-200/70 bg-slate-50/80 dark:border-white/10 dark:bg-white/5',
                        )}
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500">{item.detail}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Action mix" hint="What kinds of work were recorded">
              <ul className="space-y-2">
                {actionMix.slice(0, 10).map((row) => (
                  <li key={row.key}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="truncate">{row.label}</span>
                      <span className="font-semibold tabular-nums">{row.count}</span>
                    </div>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                      <span
                        className="block h-full rounded-full bg-primary/75"
                        style={{ width: barWidth(row.count, maxAction) }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Entity mix" hint="Which records people touched">
              <ul className="space-y-2">
                {entityMix.length === 0 ? (
                  <li className="text-sm text-slate-500">No work entities in this period.</li>
                ) : (
                  entityMix.map((row) => (
                    <li key={row.key}>
                      <div className="mb-1 flex justify-between gap-2 text-sm">
                        <span className="truncate">{row.label}</span>
                        <span className="font-semibold tabular-nums">{row.count}</span>
                      </div>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                        <span
                          className="block h-full rounded-full bg-emerald-500/70"
                          style={{ width: barWidth(row.count, maxEntity) }}
                        />
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Top companies by activity"
              action={
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => goTab('companies')}
                >
                  View all
                </button>
              }
            >
              <ul className="space-y-1">
                {[...companies]
                  .sort((a, b) => b.auditEvents - a.auditEvents)
                  .slice(0, 6)
                  .map((company, index) => (
                    <li key={company.orgId}>
                      <Link
                        href={`/databases/${company.orgId}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-primary/10"
                      >
                        <span className="min-w-0 truncate text-sm font-medium">
                          <span className="mr-2 text-xs text-slate-400">#{index + 1}</span>
                          {company.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                          {company.auditEvents}
                          {company.eventsDeltaPct != null
                            ? ` · ${company.eventsDeltaPct >= 0 ? '+' : ''}${company.eventsDeltaPct}%`
                            : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </Panel>
            <Panel
              title="Top people"
              action={
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => goTab('people')}
                >
                  View all
                </button>
              }
            >
              <ul className="space-y-1">
                {users.slice(0, 6).map((user) => (
                  <li key={user.userId}>
                    <Link
                      href={`/databases/users?user=${user.userId}`}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-primary/10"
                    >
                      <Avatar className="size-7 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-primary/15 text-[0.65rem] font-semibold text-primary">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{user.name}</span>
                        <span className="block truncate text-[0.65rem] text-slate-500">
                          {user.twoFactorOn ? '2FA on' : '2FA off'} ·{' '}
                          {user.companyNames.slice(0, 2).join(' · ') || 'No company'}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold ring-1',
                          bandClass(user.band),
                        )}
                      >
                        {user.score}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === 'companies' ? (
        <Panel
          title="Company usage report"
          hint="Size, seats, books volume, period delta, and risk flags"
          action={
            <div className="inline-flex rounded-lg border border-slate-200/80 p-0.5 dark:border-white/10">
              {(
                [
                  { id: 'size' as const, label: 'Size' },
                  { id: 'events' as const, label: 'Events' },
                  { id: 'risk' as const, label: 'Risk' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCompanySort(opt.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[0.7rem] font-semibold',
                    companySort === opt.id
                      ? 'bg-primary text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="text-[0.65rem] tracking-wide text-slate-500 uppercase">
                <tr className="border-b border-slate-200/70 dark:border-white/10">
                  <th className="px-2 py-2 font-semibold">Company</th>
                  <th className="px-2 py-2 font-semibold">Data</th>
                  <th className="px-2 py-2 font-semibold">Seats</th>
                  <th className="px-2 py-2 font-semibold">Events</th>
                  <th className="px-2 py-2 font-semibold">Trend</th>
                  <th className="px-2 py-2 font-semibold">Security</th>
                  <th className="px-2 py-2 font-semibold">Books</th>
                  <th className="px-2 py-2 font-semibold">Last active</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-10 text-center text-slate-500">
                      No companies match.
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company, index) => (
                    <tr
                      key={company.orgId}
                      className="border-b border-slate-100/80 dark:border-white/5"
                    >
                      <td className="px-2 py-3">
                        <Link
                          href={`/databases/${company.orgId}`}
                          className="font-semibold text-slate-900 hover:text-primary dark:text-white dark:hover:text-primary"
                        >
                          <span className="mr-1.5 text-xs font-medium text-slate-400">
                            #{index + 1}
                          </span>
                          {company.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {company.riskFlags.map((flag) => (
                            <span
                              key={flag}
                              className="rounded bg-amber-500/15 px-1.5 py-px text-[0.6rem] font-semibold text-amber-800 dark:text-amber-200"
                            >
                              {flag}
                            </span>
                          ))}
                          {company.onTrial ? (
                            <span className="rounded bg-primary/10 px-1.5 py-px text-[0.6rem] font-semibold text-primary">
                              Trial{company.daysLeft != null ? ` · ${company.daysLeft}d` : ''}
                            </span>
                          ) : null}
                        </div>
                        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                          <span
                            className="block h-full rounded-full bg-primary/75"
                            style={{ width: barWidth(company.sizeBytes, maxSize) }}
                          />
                        </span>
                      </td>
                      <td className="px-2 py-3 font-medium tabular-nums">
                        {formatBytes(company.sizeBytes)}
                        <p className="text-[0.65rem] text-slate-500">{company.modulesOn} apps on</p>
                      </td>
                      <td className="px-2 py-3 tabular-nums">
                        {company.activeUsers}
                        {company.maxUsers != null ? ` / ${company.maxUsers}` : ''}
                        {company.seatUtilizationPct != null ? (
                          <p className="text-[0.65rem] text-slate-500">
                            {company.seatUtilizationPct}% used
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 font-medium tabular-nums">
                        {company.auditEvents}
                        <p className="text-[0.65rem] text-slate-500">
                          {company.workEvents} work · {company.uniqueActors} movers
                        </p>
                      </td>
                      <td className="px-2 py-3 tabular-nums">
                        {company.eventsDeltaPct == null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span
                            className={cn(
                              'font-semibold',
                              company.eventsDeltaPct < 0
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-emerald-700 dark:text-emerald-300',
                            )}
                          >
                            {company.eventsDeltaPct >= 0 ? '+' : ''}
                            {company.eventsDeltaPct}%
                          </span>
                        )}
                        <p className="text-[0.65rem] text-slate-500">
                          was {company.prevAuditEvents}
                        </p>
                      </td>
                      <td className="px-2 py-3 tabular-nums">
                        {company.logins} ok
                        {company.failedLogins > 0 ? (
                          <p className="text-[0.65rem] text-amber-700 dark:text-amber-300">
                            {company.failedLogins} failed
                          </p>
                        ) : (
                          <p className="text-[0.65rem] text-slate-500">0 failed</p>
                        )}
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-500">
                        <p>{company.customers} customers</p>
                        <p>
                          {company.salesDocs} sales · {company.purchaseDocs} purchases
                        </p>
                        <p>
                          {company.items} items · {company.vendors} vendors
                        </p>
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-500">{company.lastActiveLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {tab === 'people' ? (
        <Panel
          title="People motion report"
          hint="Cross-company ranking, 2FA, and work breakdown"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                downloadCsv(
                  `platform-people-${isAllPerformanceDays(days) ? 'all' : `${days}d`}.csv`,
                  [
                    'Rank',
                    'Name',
                    'Email',
                    'Score',
                    'Band',
                    '2FA',
                    'Companies',
                    'Created',
                    'Posted',
                    'Approved',
                    'FailedLogins',
                  ],
                  filteredUsers.map((u) => [
                    String(u.rank),
                    u.name,
                    u.email,
                    String(u.score),
                    u.band,
                    u.twoFactorOn ? 'on' : 'off',
                    u.companyNames.join('|'),
                    String(u.counts.created),
                    String(u.counts.posted),
                    String(u.counts.approved),
                    String(u.counts.failedLogins),
                  ]),
                )
              }
            >
              <DownloadIcon className="size-3.5" />
              Export people
            </Button>
          }
        >
          <ul className="space-y-2">
            {filteredUsers.length === 0 ? (
              <li className="py-10 text-center text-sm text-slate-500">No people match.</li>
            ) : (
              filteredUsers.map((user) => (
                <li key={user.userId}>
                  <Link
                    href={`/databases/users?user=${user.userId}`}
                    className="block rounded-2xl border border-slate-200/70 bg-slate-50/50 px-3 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 shrink-0 pt-1 text-center text-xs font-semibold text-slate-400">
                        {user.rank}
                      </span>
                      <Avatar className="size-10 rounded-xl">
                        <AvatarFallback className="rounded-xl bg-primary/15 text-sm font-semibold text-primary">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {user.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold ring-1',
                                user.twoFactorOn
                                  ? 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300'
                                  : 'bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:text-amber-200',
                              )}
                            >
                              {user.twoFactorOn ? '2FA on' : '2FA off'}
                            </span>
                            <span
                              className={cn(
                                'rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold ring-1',
                                bandClass(user.band),
                              )}
                            >
                              {PERFORMANCE_BAND_LABEL[user.band]}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">{user.score}</span>
                          </div>
                        </div>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                          <span
                            className="block h-full rounded-full bg-emerald-500/70"
                            style={{ width: barWidth(user.score, maxScore) }}
                          />
                        </span>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-slate-500">
                          <span>{user.activeDays}d active</span>
                          <span>{user.workActions} work</span>
                          <span>{user.companyCount} companies</span>
                          <span>Created {user.counts.created}</span>
                          <span>Posted {user.counts.posted}</span>
                          <span>Approved {user.counts.approved}</span>
                          {user.counts.failedLogins > 0 ? (
                            <span className="text-amber-700 dark:text-amber-300">
                              {user.counts.failedLogins} failed sign-ins
                            </span>
                          ) : null}
                          {user.topActionLabel ? <span>Top · {user.topActionLabel}</span> : null}
                          <span>Last · {user.lastActiveLabel}</span>
                        </div>
                        <p className="mt-1 truncate text-[0.7rem] text-slate-500">
                          {user.companyNames.join(' · ') || 'No company'}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Panel>
      ) : null}

      {tab === 'security' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-[#0c1018]/80">
              <div className="flex items-center justify-between">
                <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Failed sign-ins
                </p>
                <ShieldAlertIcon className="size-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{insights.failedLogins}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-[#0c1018]/80">
              <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Suspicious IPs
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {insights.suspiciousIpCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">3+ failed attempts from one IP</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-[#0c1018]/80">
              <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                2FA coverage
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{insights.twoFactorPct}%</p>
              <p className="mt-1 text-xs text-slate-500">
                {insights.twoFactorOff} staff still without 2FA
              </p>
            </div>
          </div>

          <Panel
            title="Suspicious IP addresses"
            hint="Repeat failed sign-ins — common multi-tenant security signal"
          >
            {suspiciousIps.length === 0 ? (
              <p className="text-sm text-slate-500">No suspicious IPs in this period.</p>
            ) : (
              <ul className="space-y-2">
                {suspiciousIps.map((row) => (
                  <li
                    key={row.ipAddress}
                    className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-mono text-sm font-semibold">{row.ipAddress}</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {row.failedCount} failed
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                      {row.companyNames.join(' · ')} · last {row.lastAtLabel}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="People without 2FA (active movers)" hint="Highest priority if they have failed sign-ins">
            <ul className="space-y-1">
              {users
                .filter((u) => !u.twoFactorOn)
                .slice(0, 15)
                .map((user) => (
                  <li key={user.userId}>
                    <Link
                      href={`/databases/users?user=${user.userId}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-primary/10"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{user.name}</span>
                        <span className="block truncate text-xs text-slate-500">{user.email}</span>
                      </span>
                      <span className="text-xs text-slate-500">
                        {user.counts.failedLogins > 0
                          ? `${user.counts.failedLogins} failed`
                          : 'No failed'}
                      </span>
                    </Link>
                  </li>
                ))}
              {users.every((u) => u.twoFactorOn) ? (
                <li className="py-6 text-center text-sm text-slate-500">
                  All movers in this period have 2FA on.
                </li>
              ) : null}
            </ul>
          </Panel>
        </div>
      ) : null}

      {tab === 'adoption' ? (
        <Panel
          title="Feature / app adoption"
          hint="Share of companies with each app turned on (tenant feature consumption)"
        >
          <ul className="space-y-2">
            {featureAdoption.map((row) => (
              <li key={row.key}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{row.label}</span>
                  <span className="tabular-nums text-slate-500">
                    {row.companiesOn}/{totals.companies} · {row.pct}%
                  </span>
                </div>
                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-primary/75"
                    style={{ width: barWidth(row.pct, maxAdoption) }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {tab === 'feed' ? (
        <Panel
          title="Live motion feed"
          hint={`Latest ${events.length} events · filter work or security`}
          action={
            <div className="inline-flex rounded-lg border border-slate-200/80 p-0.5 dark:border-white/10">
              {(
                [
                  { id: 'all' as const, label: 'All' },
                  { id: 'work' as const, label: 'Work' },
                  { id: 'security' as const, label: 'Security' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFeedFilter(opt.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[0.7rem] font-semibold',
                    feedFilter === opt.id
                      ? 'bg-primary text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          }
        >
          <ul className="space-y-2">
            {filteredEvents.length === 0 ? (
              <li className="py-10 text-center text-sm text-slate-500">No events match.</li>
            ) : (
              filteredEvents.map((event) => (
                <li
                  key={event.id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5',
                    event.action === 'LOGIN_FAILED'
                      ? 'border-amber-500/30 bg-amber-500/10'
                      : 'border-slate-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5',
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {event.actorId ? (
                        <Link
                          href={`/databases/users?user=${event.actorId}`}
                          className="hover:text-primary"
                        >
                          {event.actorName}
                        </Link>
                      ) : (
                        event.actorName
                      )}
                      <span className="font-normal text-slate-500">
                        {' '}
                        · {event.actionLabel} · {event.entityLabel}
                      </span>
                    </p>
                    <p className="text-[0.65rem] text-slate-500">{event.atLabel}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    <Link
                      href={`/databases/${event.orgId}`}
                      className="font-medium hover:text-primary"
                    >
                      {event.orgName}
                    </Link>
                    {event.ipAddress ? ` · ${event.ipAddress}` : ''}
                    {event.detail ? ` · ${event.detail}` : ''}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}
