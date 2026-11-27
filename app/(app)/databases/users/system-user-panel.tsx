'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ActivityIcon,
  Building2Icon,
  ExternalLinkIcon,
  FileBarChartIcon,
  HistoryIcon,
  KeyRoundIcon,
  LogOutIcon,
  ShieldOffIcon,
  Trash2Icon,
  TrendingUpIcon,
  UserPlusIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { ResetWorkPasswordDialog } from '@/components/settings/reset-work-password-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { ROLE_LABELS } from '@/lib/roles'
import { PerformancePeriodPicker } from '@/components/performance-period-picker'
import {
  PERFORMANCE_BAND_HINT,
  PERFORMANCE_BAND_LABEL,
  performancePeriodLabel,
  performancePeriodShortLabel,
  type PerformanceBand,
  type PerformancePeriodDays,
} from '@/lib/user-performance'
import {
  memberAvatarClass,
  memberAvatarStyle,
  memberInitials,
} from '@/lib/member-avatar'
import { presenceDotClass } from '@/lib/presence'
import { cn } from '@/lib/utils'
import {
  addSystemUserToCompany,
  deleteSystemUser,
  disableSystemUserTwoFactor,
  forceSignOutSystemUser,
  resetSystemUserPasswordForm,
  setSystemUserStatus,
} from './actions'
import type { AssignableCompany, SystemUserRow } from './system-users-workspace'
import type { Role } from '@prisma/client'

export type SystemUserReportView = {
  days: PerformancePeriodDays
  score: number
  band: PerformanceBand
  rank: number
  rankedAmong: number
  activeDays: number
  workActions: number
  eventCount: number
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
  companyNames: string[]
  breakdown: {
    action: string
    label: string
    count: number
    weight: number
    points: number
  }[]
  activity: {
    id: string
    atLabel: string
    actionLabel: string
    entityLabel: string
    detail: string | null
    orgName: string
    ipAddress: string | null
  }[]
  daily: { day: string; events: number; work: number; logins: number }[]
}

type PanelTab = 'report' | 'performance' | 'activity' | 'manage'

function Section({
  title,
  children,
  tone = 'default',
  action,
}: {
  title: string
  children: ReactNode
  tone?: 'default' | 'danger'
  action?: ReactNode
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border p-4',
        tone === 'danger'
          ? 'border-destructive/25 bg-destructive/5'
          : 'border-border/60 bg-background/35 backdrop-blur-sm',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3
          className={cn(
            'text-[0.7rem] font-semibold tracking-[0.14em] uppercase',
            tone === 'danger' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function bandClass(band: PerformanceBand): string {
  switch (band) {
    case 'top':
      return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
    case 'steady':
      return 'bg-primary/15 text-primary ring-primary/25'
    case 'low':
      return 'bg-amber-500/15 text-amber-200 ring-amber-500/25'
    case 'inactive':
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/20'
  }
}

function ActivitySparkline({
  daily,
}: {
  daily: SystemUserReportView['daily']
}) {
  const max = Math.max(1, ...daily.map((d) => d.events))
  return (
    <div className="flex h-16 items-end gap-0.5 rounded-xl border border-border/40 bg-background/20 px-2 py-2">
      {daily.map((point) => {
        const px = point.events === 0 ? 2 : Math.max(4, Math.round((point.events / max) * 48))
        const workPx = point.events > 0 ? Math.round(px * (point.work / point.events)) : 0
        return (
          <div
            key={point.day}
            title={`${point.day}: ${point.events} events · ${point.work} work · ${point.logins} logins`}
            className="group relative min-w-0 flex-1"
            style={{ height: px }}
          >
            <span className="absolute inset-0 rounded-t-sm bg-primary/30 transition-colors group-hover:bg-primary/50" />
            {workPx > 0 ? (
              <span
                className="absolute inset-x-0 bottom-0 rounded-t-sm bg-emerald-400/75"
                style={{ height: workPx }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function BreakdownBars({
  breakdown,
}: {
  breakdown: SystemUserReportView['breakdown']
}) {
  const maxPoints = Math.max(1, ...breakdown.map((item) => item.points))
  if (breakdown.length === 0) {
    return <p className="text-sm text-muted-foreground">No scored work in this period.</p>
  }
  return (
    <ul className="space-y-2.5">
      {breakdown.slice(0, 8).map((item) => (
        <li key={item.action}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {item.label}
              <span className="ml-1.5 text-xs text-muted-foreground">×{item.count}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{item.points}</span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-background/40">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_70%,#22c55e),var(--primary))]"
              style={{ width: `${Math.max(4, Math.round((item.points / maxPoints) * 100))}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function SystemUserPanel({
  user,
  companies,
  roles,
  report,
  onClose,
}: {
  user: SystemUserRow
  companies: AssignableCompany[]
  roles: string[]
  report: SystemUserReportView | null
  onClose?: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, start] = useTransition()
  const [resetOpen, setResetOpen] = useState(false)
  const [tab, setTab] = useState<PanelTab>('report')
  const memberOrgIds = useMemo(() => new Set(user.memberOrgIds), [user.memberOrgIds])
  const availableCompanies = useMemo(
    () => companies.filter((company) => !memberOrgIds.has(company.id)),
    [companies, memberOrgIds],
  )
  const [orgId, setOrgId] = useState(availableCompanies[0]?.id ?? '')
  const [role, setRole] = useState(roles[0] ?? 'VIEWER')

  const canStatus = user.hasStaffMembership && !user.isSystemOwner && !user.isSelf
  const canDelete = !user.isSystemOwner && !user.ownsCompany && !user.isSelf
  const canReset = !user.isSelf
  const canForceSignOut = !user.isSelf
  const canDisable2fa = !user.isSelf && !user.isSystemOwner && user.twoFactorOn
  const canAssign =
    !user.isSelf && user.kind !== 'portal' && availableCompanies.length > 0 && !user.isSystemOwner

  const days = report?.days ?? 30

  function setDays(nextDays: PerformancePeriodDays) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('user', user.id)
    if (nextDays === 30) next.delete('days')
    else if (nextDays === 0) next.set('days', 'all')
    else next.set('days', String(nextDays))
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }

  function run(
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success: string,
    after?: () => void,
  ) {
    start(async () => {
      const result = await fn()
      if (result.ok) {
        toast.success(success)
        after?.()
        router.refresh()
      } else {
        toast.error(result.error?.message ?? 'That did not work.')
      }
    })
  }

  const tabs: { value: PanelTab; label: string; icon: typeof FileBarChartIcon }[] = [
    { value: 'report', label: 'Report', icon: FileBarChartIcon },
    { value: 'performance', label: 'Performance', icon: TrendingUpIcon },
    { value: 'activity', label: 'Activity', icon: ActivityIcon },
    { value: 'manage', label: 'Manage', icon: KeyRoundIcon },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative overflow-hidden border-b border-border/50 px-5 py-5 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_45%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -bottom-10 size-40 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#22c55e_16%,transparent),transparent_70%)]"
        />
        <div className="relative flex items-start gap-4">
          <span className="relative">
            <Avatar className={memberAvatarClass('md')} style={memberAvatarStyle(user.name)}>
              <AvatarFallback
                className="bg-transparent text-inherit"
                style={memberAvatarStyle(user.name)}
              >
                {memberInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span
              title={user.presenceLabel}
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-[color-mix(in_oklab,var(--card)_92%,black)]',
                presenceDotClass(user.online),
              )}
            />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight">{user.name}</h2>
              {user.isSelf ? (
                <span className="rounded-md bg-background/50 px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground uppercase">
                  you
                </span>
              ) : null}
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide',
                  user.online
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {user.presenceLabel}
              </span>
              {report ? (
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-semibold ring-1',
                    bandClass(report.band),
                  )}
                >
                  {PERFORMANCE_BAND_LABEL[report.band]}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                {user.kindLabel}
              </span>
              {user.twoFactorOn ? (
                <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                  2FA on
                </span>
              ) : (
                <span className="rounded-lg bg-background/45 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  2FA off
                </span>
              )}
              {user.statusLabel ? (
                <span className="text-xs text-muted-foreground">{user.statusLabel}</span>
              ) : null}
              {report && report.rankedAmong > 0 ? (
                <span className="text-xs text-muted-foreground">
                  #{report.rank} of {report.rankedAmong} ·{' '}
                  {performancePeriodShortLabel(report.days)}
                </span>
              ) : null}
            </div>
          </div>
          {onClose ? (
            <Button type="button" variant="ghost" size="sm" className="lg:hidden" onClick={onClose}>
              Back
            </Button>
          ) : null}
        </div>

        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-border/60 bg-background/30 p-1">
            {tabs.map((item) => {
              const Icon = item.icon
              const active = tab === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTab(item.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
          <PerformancePeriodPicker days={days} onChange={setDays} />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {user.isSelf ? (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-100/90">
            This is your login. Manage other people from this console.
          </p>
        ) : null}

        {tab === 'report' ? (
          <>
            <Section
              title={`Report · ${performancePeriodLabel(days)}`}
              action={
                <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                  <Link href="/databases/activity">
                    <ExternalLinkIcon className="size-3.5" />
                    Platform activity
                  </Link>
                </Button>
              }
            >
              {report ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'Score', value: String(report.score) },
                      {
                        label: 'Rank',
                        value: report.rankedAmong > 0 ? `#${report.rank}` : '—',
                      },
                      { label: 'Events', value: String(report.eventCount) },
                      { label: 'Active days', value: String(report.activeDays) },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-border/50 bg-background/25 px-3 py-2.5"
                      >
                        <p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                          {stat.label}
                        </p>
                        <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <ActivitySparkline daily={report.daily} />
                  <p className="text-xs text-muted-foreground">
                    Daily motion · green = books work · Last active {report.lastActiveLabel}
                    {report.topActionLabel ? ` · Top action ${report.topActionLabel}` : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <span>Created {report.counts.created}</span>
                    <span>Changed {report.counts.updated}</span>
                    <span>Posted {report.counts.posted}</span>
                    <span>Approved {report.counts.approved}</span>
                    <span>Sign-in days {report.counts.logins}</span>
                    <span>Failed logins {report.counts.failedLogins}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No report for this login yet. Activity appears after they sign in and work.
                </p>
              )}
            </Section>

            <Section title="Overview">
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-background/25 px-3 py-2">
                  <dt className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                    Presence
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {user.presenceLabel}
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {user.lastActiveLabel}
                    </span>
                  </dd>
                </div>
                <div className="rounded-xl bg-background/25 px-3 py-2">
                  <dt className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                    Last signed in
                  </dt>
                  <dd className="mt-0.5 font-medium">{user.lastLoginLabel}</dd>
                </div>
                <div className="rounded-xl bg-background/25 px-3 py-2 sm:col-span-2">
                  <dt className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                    Created
                  </dt>
                  <dd className="mt-0.5 font-medium">{user.createdLabel}</dd>
                </div>
              </dl>
            </Section>

            <Section title="Companies">
              {user.companies.length > 0 ? (
                <ul className="space-y-2">
                  {user.companies.map((company) => (
                    <li
                      key={company.rootId}
                      className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/25 px-3 py-2.5"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                        <Building2Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{company.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {company.roleLabel}
                          {company.companyCount > 1 ? ` · ${company.companyCount} companies` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : user.kind === 'portal' ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Customer portal login — managed under Customers, not company staff.
                  </p>
                  <ul className="space-y-2">
                    {user.portalCompanies.map((company) => (
                      <li
                        key={company.id}
                        className="rounded-xl border border-border/50 bg-background/25 px-3 py-2.5 text-sm"
                      >
                        <span className="font-semibold">{company.name}</span>
                        <span className="text-muted-foreground"> · Customer portal</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : user.kind === 'platform' ? (
                <p className="text-sm text-muted-foreground">
                  Platform login you need to run this installation. Kept separate from company staff.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Unused login — no company membership. Add them to a company below, or delete.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                  <Link href="/databases">Open Databases</Link>
                </Button>
                {user.companies.length > 0 ? (
                  <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                    <Link href="/settings/users">Company users</Link>
                  </Button>
                ) : null}
              </div>
            </Section>

            <Section title="Where to dig deeper">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                  <Link href="/databases/activity?tab=people">
                    <TrendingUpIcon className="size-3.5" />
                    People ranking
                  </Link>
                </Button>
                {user.companies[0] ? (
                  <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                    <Link href="/settings/user-history">
                      <HistoryIcon className="size-3.5" />
                      Company history
                    </Link>
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                  <Link href="/settings/user-performance">
                    <FileBarChartIcon className="size-3.5" />
                    Team performance
                  </Link>
                </Button>
              </div>
            </Section>
          </>
        ) : null}

        {tab === 'performance' ? (
          <>
            <Section title={`Performance · ${performancePeriodLabel(days)}`}>
              {report ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold tracking-tight tabular-nums">
                        {report.score}
                        <span className="ml-2 text-sm font-medium text-muted-foreground">
                          pts
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {PERFORMANCE_BAND_HINT[report.band]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-xs font-semibold ring-1',
                        bandClass(report.band),
                      )}
                    >
                      {PERFORMANCE_BAND_LABEL[report.band]}
                      {report.rankedAmong > 0 ? ` · #${report.rank}` : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Work actions', value: report.workActions },
                      { label: 'Active days', value: report.activeDays },
                      { label: 'Events', value: report.eventCount },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-border/50 bg-background/25 px-3 py-2.5 text-center"
                      >
                        <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
                        <p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <ActivitySparkline daily={report.daily} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No performance signals yet.</p>
              )}
            </Section>

            <Section title="Work breakdown">
              {report ? <BreakdownBars breakdown={report.breakdown} /> : null}
              {report ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>Created {report.counts.created}</span>
                  <span>Changed {report.counts.updated}</span>
                  <span>Posted {report.counts.posted}</span>
                  <span>Approved {report.counts.approved}</span>
                  <span>Sign-in days {report.counts.logins}</span>
                  <span>Failed logins {report.counts.failedLogins}</span>
                </div>
              ) : null}
            </Section>
          </>
        ) : null}

        {tab === 'activity' ? (
          <Section
            title={`Recent activity · ${performancePeriodLabel(days)}`}
            action={
              <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                <Link href="/databases/activity?tab=feed">
                  <HistoryIcon className="size-3.5" />
                  Full feed
                </Link>
              </Button>
            }
          >
            {!report || report.activity.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No recorded activity in this period.
              </p>
            ) : (
              <ol className="relative space-y-0 border-l border-border/50 pl-4">
                {report.activity.map((item) => (
                  <li key={item.id} className="relative pb-4 last:pb-0">
                    <span className="absolute top-1.5 -left-[1.28rem] size-2.5 rounded-full bg-primary/70 ring-4 ring-[color-mix(in_oklab,var(--card)_90%,transparent)]" />
                    <div className="rounded-xl border border-border/50 bg-background/25 px-3 py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">
                          {item.actionLabel}
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            · {item.entityLabel}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{item.atLabel}</p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.orgName}
                        {item.detail ? ` · ${item.detail}` : ''}
                        {item.ipAddress ? ` · ${item.ipAddress}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        ) : null}

        {tab === 'manage' ? (
          <>
            {canAssign ? (
              <Section title="Add to company">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor="assign-org">
                      Company
                    </label>
                    <NativeSelect
                      id="assign-org"
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                    >
                      {availableCompanies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor="assign-role">
                      Role
                    </label>
                    <NativeSelect
                      id="assign-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r as Role] ?? r}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={pending || !orgId}
                    onClick={() => {
                      if (!orgId) return
                      run(
                        () =>
                          addSystemUserToCompany({
                            userId: user.id,
                            orgId,
                            role: role as Exclude<Role, 'OWNER' | 'CUSTOMER' | 'CUSTOM'>,
                          }),
                        `${user.name} added to company.`,
                      )
                    }}
                  >
                    <UserPlusIcon className="size-3.5" />
                    Add to company
                  </Button>
                </div>
              </Section>
            ) : null}

            <Section title="Status">
              {canStatus ? (
                <div className="inline-flex rounded-xl border border-border/60 bg-background/30 p-1">
                  {(
                    [
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INVITED', label: 'Pending' },
                      { value: 'SUSPENDED', label: 'Suspended' },
                    ] as const
                  ).map((option) => {
                    const active = user.status === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={pending || active}
                        onClick={() =>
                          run(
                            () => setSystemUserStatus({ userId: user.id, status: option.value }),
                            `${user.name} is ${option.label.toLowerCase()}.`,
                          )
                        }
                        className={cn(
                          'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all',
                          active
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground disabled:opacity-40',
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {user.isSystemOwner
                    ? 'System owner status is fixed.'
                    : user.ownsCompany
                      ? 'Company owners stay active until ownership is transferred.'
                      : user.statusLabel
                        ? `Current status: ${user.statusLabel}`
                        : 'No membership status yet.'}
                </p>
              )}
            </Section>

            <Section title="Security">
              <div className="flex flex-wrap gap-2">
                {canReset ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() => setResetOpen(true)}
                  >
                    <KeyRoundIcon className="size-3.5" />
                    Reset password
                  </Button>
                ) : null}
                {canForceSignOut ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Force sign-out for ${user.name} on every company?`))
                        return
                      run(
                        () => forceSignOutSystemUser({ userId: user.id }),
                        `${user.name} signed out everywhere.`,
                      )
                    }}
                  >
                    <LogOutIcon className="size-3.5" />
                    Force sign-out
                  </Button>
                ) : null}
                {canDisable2fa ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Turn off two-factor for ${user.name}? They can sign in with password only until they set it up again.`,
                        )
                      ) {
                        return
                      }
                      run(
                        () => disableSystemUserTwoFactor({ userId: user.id }),
                        `Two-factor turned off for ${user.name}.`,
                      )
                    }}
                  >
                    <ShieldOffIcon className="size-3.5" />
                    Turn off 2FA
                  </Button>
                ) : null}
                {!canReset && !canForceSignOut && !canDisable2fa ? (
                  <p className="text-sm text-muted-foreground">
                    Security actions for other people appear here.
                  </p>
                ) : null}
              </div>
            </Section>

            {canDelete ? (
              <Section title="Danger zone" tone="danger">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete ${user.name} (${user.email})? They will no longer be able to sign in.`,
                      )
                    ) {
                      return
                    }
                    run(
                      () => deleteSystemUser({ userId: user.id }),
                      `${user.name} deleted.`,
                      onClose,
                    )
                  }}
                >
                  <Trash2Icon className="size-3.5" />
                  Delete login
                </Button>
              </Section>
            ) : null}
          </>
        ) : null}
      </div>

      {canReset ? (
        <ResetWorkPasswordDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Reset work password"
          description={`Set a new temporary password for ${user.name} (${user.email}). The old password is never shown — only this new one, once.`}
          hiddenFields={{ userId: user.id }}
          formAction={resetSystemUserPasswordForm}
        />
      ) : null}
    </div>
  )
}
