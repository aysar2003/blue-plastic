'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SearchIcon, UsersIcon } from 'lucide-react'

import { PerformancePeriodPicker } from '@/components/performance-period-picker'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { PerformanceBand, PerformancePeriodDays } from '@/lib/user-performance'
import { MemberManagePanel } from './member-manage-panel'
import { presenceDotClass } from '@/lib/presence'
import {
  memberAvatarClass,
  memberAvatarStyle,
  memberInitials,
} from './member-ui'
import type { UsersTableRow } from './users-table'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INVITED' | 'SUSPENDED'

export type UsersPerformanceMap = Record<
  string,
  { score: number; band: PerformanceBand; rank: number }
>

export function UsersWorkspace({
  rows,
  roles,
  roleTemplates,
  canUpdate,
  canRemove,
  selectedId,
  days,
  performanceByUserId,
}: {
  rows: UsersTableRow[]
  roles: string[]
  roleTemplates: Record<string, string[]>
  canUpdate: boolean
  canRemove: boolean
  selectedId: string | null
  days: PerformancePeriodDays
  performanceByUserId?: UsersPerformanceMap
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [localQuery, setLocalQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [presenceFilter, setPresenceFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL')
  const autoSelected = useRef(false)

  function writeDays(params: URLSearchParams, nextDays: PerformancePeriodDays) {
    if (nextDays === 30) params.delete('days')
    else if (nextDays === 0) params.set('days', 'all')
    else params.set('days', String(nextDays))
  }

  function setDays(nextDays: PerformancePeriodDays) {
    const next = new URLSearchParams(searchParams.toString())
    writeDays(next, nextDays)
    if (selectedId) next.set('member', selectedId)
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  )

  const onlineCount = useMemo(() => rows.filter((row) => row.online).length, [rows])

  const filtered = useMemo(() => {
    const q = localQuery.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false
      if (presenceFilter === 'ONLINE' && !row.online) return false
      if (presenceFilter === 'OFFLINE' && row.online) return false
      if (!q) return true
      return row.name.toLowerCase().includes(q) || row.email.toLowerCase().includes(q)
    })
  }, [rows, localQuery, statusFilter, presenceFilter])

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000)
    return () => window.clearInterval(timer)
  }, [router])

  useEffect(() => {
    if (autoSelected.current || selectedId) return
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) return
    const first = filtered[0]
    if (!first) return
    autoSelected.current = true
    const next = new URLSearchParams(searchParams.toString())
    next.set('member', first.id)
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }, [selectedId, filtered, pathname, router, searchParams])

  function selectMember(id: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    writeDays(next, days)
    if (id) next.set('member', id)
    else next.delete('member')
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/70',
        'bg-[linear-gradient(165deg,color-mix(in_oklab,var(--card)_92%,var(--primary)_8%),var(--card)_42%,color-mix(in_oklab,var(--card)_88%,var(--primary)_6%))]',
        'shadow-[0_24px_60px_-36px_rgb(0_0_0/0.55)]',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_58%)]"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">Performance period</p>
        <PerformancePeriodPicker days={days} onChange={setDays} />
      </div>

      <div className="relative grid min-h-[36rem] lg:grid-cols-[minmax(17rem,23rem)_minmax(0,1fr)]">
        <div
          className={cn(
            'flex min-h-0 flex-col border-border/60 backdrop-blur-[2px] lg:border-r',
            selected ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="space-y-3 border-b border-border/50 p-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search by name or email"
                aria-label="Search members"
                className={cn(
                  'h-10 w-full rounded-xl border border-border/70 bg-background/40 pr-3 pl-9 text-sm',
                  'outline-none transition-[border-color,box-shadow,background-color]',
                  'placeholder:text-muted-foreground/80',
                  'focus:border-primary/50 focus:bg-background/70 focus:ring-2 focus:ring-primary/20',
                )}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { value: 'ALL', label: 'All' },
                  { value: 'ONLINE', label: `Online ${onlineCount}` },
                  { value: 'OFFLINE', label: 'Offline' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setPresenceFilter(chip.value)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide uppercase transition-all',
                    presenceFilter === chip.value
                      ? 'bg-emerald-600 text-white shadow-[0_8px_20px_-12px_rgb(5_150_105)]'
                      : 'bg-background/35 text-muted-foreground hover:bg-background/55 hover:text-foreground',
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { value: 'ALL', label: 'Any status' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INVITED', label: 'Pending' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setStatusFilter(chip.value)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide uppercase transition-all',
                    statusFilter === chip.value
                      ? 'bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_var(--primary)]'
                      : 'bg-background/35 text-muted-foreground hover:bg-background/55 hover:text-foreground',
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <p className="text-[0.7rem] text-muted-foreground">
              {filtered.length} member{filtered.length === 1 ? '' : 's'}
              {onlineCount > 0 ? ` · ${onlineCount} online now` : null}
            </p>
          </div>

          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" role="listbox" aria-label="Company members">
            {filtered.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                No members match.
              </li>
            ) : (
              filtered.map((row) => {
                const active = row.id === selectedId
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => selectMember(row.id)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all duration-200',
                        active
                          ? 'bg-primary/12 ring-1 ring-primary/35 shadow-[inset_3px_0_0_0_var(--primary)]'
                          : 'hover:bg-background/40',
                      )}
                    >
                      <span className="relative">
                        <Avatar className={memberAvatarClass('sm')} style={memberAvatarStyle(row.name)}>
                          <AvatarFallback
                            className="bg-transparent text-inherit"
                            style={memberAvatarStyle(row.name)}
                          >
                            {memberInitials(row.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          title={row.presenceLabel}
                          className={cn(
                            'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[color-mix(in_oklab,var(--card)_90%,black)]',
                            presenceDotClass(row.online),
                          )}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[0.875rem] font-semibold tracking-tight">
                            {row.name}
                          </span>
                          {row.isSelf ? (
                            <span className="rounded bg-background/50 px-1 py-px text-[0.6rem] font-medium text-muted-foreground uppercase">
                              you
                            </span>
                          ) : null}
                          {row.online ? (
                            <span className="rounded bg-emerald-500/15 px-1 py-px text-[0.6rem] font-semibold tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                              online
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {row.roleLabel} · {row.lastActiveLabel}
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
            selected ? 'flex flex-col animate-in fade-in-0 slide-in-from-right-2 duration-300' : 'hidden lg:flex lg:flex-col',
          )}
        >
          {selected ? (
            <MemberManagePanel
              key={selected.id}
              member={selected}
              roles={roles}
              roleTemplates={roleTemplates}
              canUpdate={canUpdate}
              canRemove={canRemove}
              days={days}
              performance={performanceByUserId?.[selected.userId] ?? null}
              onClose={() => selectMember(null)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UsersIcon className="size-7" />
              </div>
              <p className="text-base font-semibold tracking-tight">Select a member</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Choose someone on the left to manage role, apps, status, password, and access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
