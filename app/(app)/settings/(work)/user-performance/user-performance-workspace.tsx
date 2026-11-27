'use client'

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ExternalLinkIcon, HistoryIcon, TrendingUpIcon } from 'lucide-react'

import { PerformancePeriodPicker } from '@/components/performance-period-picker'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  PERFORMANCE_BAND_HINT,
  PERFORMANCE_BAND_LABEL,
  performancePeriodLabel,
  type PerformanceBand,
  type PerformancePeriodDays,
} from '@/lib/user-performance'
import { cn } from '@/lib/utils'
import {
  memberAvatarClass,
  memberAvatarStyle,
  memberInitials,
} from '../users/member-ui'

export type PerformanceListRow = {
  userId: string
  membershipId: string
  name: string
  email: string
  roleLabel: string
  score: number
  band: PerformanceBand
  rank: number
  activeDays: number
  workActions: number
  counts: {
    created: number
    updated: number
    posted: number
    approved: number
    logins: number
  }
  lastActiveLabel: string
}

export type PerformanceDetail = PerformanceListRow & {
  activity: {
    id: string
    atLabel: string
    actionLabel: string
    entityLabel: string
    detail: string | null
  }[]
  breakdown: { action: string; label: string; count: number; weight: number; points: number }[]
}

function bandClass(band: PerformanceBand): string {
  switch (band) {
    case 'top':
      return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
    case 'steady':
      return 'bg-primary/15 text-primary ring-primary/30'
    case 'low':
      return 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
    case 'inactive':
      return 'bg-muted/60 text-muted-foreground ring-border/50'
  }
}

function scoreBarWidth(score: number, maxScore: number): string {
  if (maxScore <= 0) return '0%'
  return `${Math.max(4, Math.round((score / maxScore) * 100))}%`
}

export function UserPerformanceWorkspace({
  days,
  rows,
  selected,
}: {
  days: PerformancePeriodDays
  rows: PerformanceListRow[]
  selected: PerformanceDetail | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const autoSelected = useRef(false)
  const maxScore = useMemo(() => Math.max(0, ...rows.map((r) => r.score)), [rows])

  useEffect(() => {
    if (autoSelected.current || selected || rows.length === 0) return
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) return
    autoSelected.current = true
    const next = new URLSearchParams(searchParams.toString())
    next.set('user', rows[0]!.userId)
    if (days === 30) next.delete('days')
    else if (days === 0) next.set('days', 'all')
    else next.set('days', String(days))
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }, [selected, rows, days, pathname, router, searchParams])

  function writeDays(params: URLSearchParams, nextDays: PerformancePeriodDays) {
    if (nextDays === 30) params.delete('days')
    else if (nextDays === 0) params.set('days', 'all')
    else params.set('days', String(nextDays))
  }

  function setDays(nextDays: PerformancePeriodDays) {
    const next = new URLSearchParams(searchParams.toString())
    writeDays(next, nextDays)
    if (selected) next.set('user', selected.userId)
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }

  function selectUser(userId: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    writeDays(next, days)
    if (userId) next.set('user', userId)
    else next.delete('user')
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/70',
        'bg-[linear-gradient(165deg,color-mix(in_oklab,var(--card)_90%,var(--primary)_10%),var(--card)_40%,color-mix(in_oklab,var(--card)_88%,var(--success)_8%))]',
        'shadow-[0_24px_60px_-36px_rgb(0_0_0/0.55)]',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_55%)]"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUpIcon className="size-4 text-primary" />
          Ranked by recorded work in the books
        </div>
        <PerformancePeriodPicker days={days} onChange={setDays} />
      </div>

      <div className="relative grid min-h-[36rem] lg:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)]">
        <div
          className={cn(
            'flex min-h-0 flex-col border-border/60 lg:border-r',
            selected ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="border-b border-border/50 px-4 py-3">
            <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Leaderboard
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rows.length} people · {performancePeriodLabel(days)}
            </p>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" role="listbox">
            {rows.length === 0 ? (
              <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                No company users yet.
              </li>
            ) : (
              rows.map((row) => {
                const active = selected?.userId === row.userId
                return (
                  <li key={row.userId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => selectUser(row.userId)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all duration-200',
                        active
                          ? 'bg-primary/12 shadow-[inset_3px_0_0_0_var(--primary)] ring-1 ring-primary/35'
                          : 'hover:bg-background/40',
                      )}
                    >
                      <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                        {row.rank}
                      </span>
                      <Avatar className={memberAvatarClass('sm')} style={memberAvatarStyle(row.name)}>
                        <AvatarFallback
                          className="bg-transparent text-inherit"
                          style={memberAvatarStyle(row.name)}
                        >
                          {memberInitials(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold tracking-tight">
                            {row.name}
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {row.score}
                          </span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-background/40">
                          <span
                            className="block h-full rounded-full bg-primary/70 transition-[width] duration-500"
                            style={{ width: scoreBarWidth(row.score, maxScore) }}
                          />
                        </span>
                        <span className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded-md px-1.5 py-px text-[0.65rem] font-semibold ring-1',
                              bandClass(row.band),
                            )}
                          >
                            {PERFORMANCE_BAND_LABEL[row.band]}
                          </span>
                          <span className="truncate text-[0.65rem] text-muted-foreground">
                            {row.activeDays}d active
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        <div
          className={cn(
            'min-h-0',
            selected
              ? 'flex flex-col animate-in fade-in-0 slide-in-from-right-2 duration-300'
              : 'hidden lg:flex lg:flex-col',
          )}
        >
          {selected ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="relative overflow-hidden border-b border-border/50 px-5 py-5 sm:px-6">
                <div className="relative flex items-start gap-4">
                  <Avatar className={memberAvatarClass('md')} style={memberAvatarStyle(selected.name)}>
                    <AvatarFallback
                      className="bg-transparent text-inherit"
                      style={memberAvatarStyle(selected.name)}
                    >
                      {memberInitials(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-semibold tracking-tight">
                        {selected.name}
                      </h2>
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-semibold ring-1',
                          bandClass(selected.band),
                        )}
                      >
                        {PERFORMANCE_BAND_LABEL[selected.band]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {selected.roleLabel} · {selected.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {PERFORMANCE_BAND_HINT[selected.band]}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="lg:hidden"
                    onClick={() => selectUser(null)}
                  >
                    Back
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
                <section className="rounded-2xl border border-border/60 bg-background/35 p-4 backdrop-blur-sm">
                  <h3 className="mb-3 text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Score card
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Rank', value: `#${selected.rank}` },
                      { label: 'Score', value: String(selected.score) },
                      { label: 'Active days', value: String(selected.activeDays) },
                      { label: 'Work actions', value: String(selected.workActions) },
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
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last active · {selected.lastActiveLabel}
                  </p>
                </section>

                <section className="rounded-2xl border border-border/60 bg-background/35 p-4 backdrop-blur-sm">
                  <h3 className="mb-3 text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Work breakdown
                  </h3>
                  {selected.breakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity in this period.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selected.breakdown.slice(0, 8).map((item) => (
                        <li key={item.action} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">
                            {item.label}
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ×{item.count} · w{item.weight}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">{item.points}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-5">
                    <span>Created {selected.counts.created}</span>
                    <span>Changed {selected.counts.updated}</span>
                    <span>Posted {selected.counts.posted}</span>
                    <span>Approved {selected.counts.approved}</span>
                    <span>Sign-in days {selected.counts.logins}</span>
                  </div>
                </section>

                <section className="rounded-2xl border border-border/60 bg-background/35 p-4 backdrop-blur-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Recent activity
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                        <Link href={`/settings/users?member=${selected.membershipId}`}>
                          <ExternalLinkIcon className="size-3.5" />
                          Manage user
                        </Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                        <Link href={`/settings/user-history?userId=${selected.userId}`}>
                          <HistoryIcon className="size-3.5" />
                          Full history
                        </Link>
                      </Button>
                    </div>
                  </div>
                  {selected.activity.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No recorded activity in this period.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selected.activity.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-xl border border-border/50 bg-background/25 px-3 py-2.5"
                        >
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
                          {item.detail ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {item.detail}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <TrendingUpIcon className="size-7" />
              </div>
              <p className="text-base font-semibold tracking-tight">Select a person</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Choose someone on the left to see score, work breakdown, and recent activity.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
