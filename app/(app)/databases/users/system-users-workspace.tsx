'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SearchIcon, ShieldIcon, UsersIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  memberAvatarClass,
  memberAvatarStyle,
  memberInitials,
} from '@/lib/member-avatar'
import { presenceDotClass } from '@/lib/presence'
import { cn } from '@/lib/utils'
import { CleanupUnusedButton } from './cleanup-unused-button'
import { SystemUserPanel, type SystemUserReportView } from './system-user-panel'

type SectionFilter = 'all' | 'platform' | 'staff' | 'unused' | 'portal'

export type SystemUserCompany = {
  rootId: string
  name: string
  companyCount: number
  roleLabel: string
}

export type SystemUserKind = 'staff' | 'portal' | 'orphan' | 'platform'

export type SystemUserRow = {
  id: string
  name: string
  email: string
  isSelf: boolean
  isSystemOwner: boolean
  ownsCompany: boolean
  hasStaffMembership: boolean
  kind: SystemUserKind
  kindLabel: string
  status: string | null
  statusLabel: string | null
  statusVariant: 'success' | 'destructive' | 'warning' | null
  companies: SystemUserCompany[]
  portalCompanies: { id: string; name: string }[]
  online: boolean
  presenceLabel: 'Online' | 'Offline'
  lastActiveLabel: string
  lastLoginLabel: string
  createdLabel: string
  twoFactorOn: boolean
  memberOrgIds: string[]
}

export type AssignableCompany = { id: string; name: string }

function companyHint(row: SystemUserRow) {
  if (row.companies.length > 0) {
    return row.companies.length === 1
      ? row.companies[0]!.name
      : `${row.companies.length} companies`
  }
  if (row.kind === 'portal') {
    return row.portalCompanies[0]?.name
      ? `Portal · ${row.portalCompanies[0].name}`
      : 'Customer portal'
  }
  if (row.kind === 'platform') return 'Platform · needed'
  return 'No company'
}

export function SystemUsersWorkspace({
  rows,
  selectedId,
  companies,
  roles,
  report,
}: {
  rows: SystemUserRow[]
  selectedId: string | null
  companies: AssignableCompany[]
  roles: string[]
  report: SystemUserReportView | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [localQuery, setLocalQuery] = useState('')
  const [section, setSection] = useState<SectionFilter>('all')
  const autoSelected = useRef(false)

  const counts = useMemo(
    () => ({
      all: rows.length,
      platform: rows.filter((row) => row.kind === 'platform').length,
      staff: rows.filter((row) => row.kind === 'staff').length,
      unused: rows.filter((row) => row.kind === 'orphan').length,
      portal: rows.filter((row) => row.kind === 'portal').length,
    }),
    [rows],
  )

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  )

  const filtered = useMemo(() => {
    const q = localQuery.trim().toLowerCase()
    return rows.filter((row) => {
      if (section === 'platform' && row.kind !== 'platform') return false
      if (section === 'staff' && row.kind !== 'staff') return false
      if (section === 'unused' && row.kind !== 'orphan') return false
      if (section === 'portal' && row.kind !== 'portal') return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.companies.some((company) => company.name.toLowerCase().includes(q)) ||
        row.portalCompanies.some((company) => company.name.toLowerCase().includes(q))
      )
    })
  }, [rows, localQuery, section])

  useEffect(() => {
    // Prefer the section that matches the selected user — keep "all" when browsing everyone.
    if (!selected) return
    setSection((current) => {
      if (current === 'all') return current
      return selected.kind === 'platform'
        ? 'platform'
        : selected.kind === 'staff'
          ? 'staff'
          : selected.kind === 'portal'
            ? 'portal'
            : 'unused'
    })
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- only when selection identity changes

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000)
    return () => window.clearInterval(timer)
  }, [router])

  useEffect(() => {
    if (autoSelected.current || selectedId) return
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) return
    const platformFirst = rows.find((row) => row.kind === 'platform')
    const first = platformFirst ?? filtered[0]
    if (!first) return
    autoSelected.current = true
    const next = new URLSearchParams(searchParams.toString())
    next.set('user', first.id)
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }, [selectedId, filtered, rows, pathname, router, searchParams])

  function selectUser(id: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (id) next.set('user', id)
    else next.delete('user')
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }

  const sectionCopy =
    section === 'all'
      ? 'Every login on this installation — platform, company staff, unused, and portal.'
      : section === 'platform'
        ? 'Installation owners you use to run the platform. Needed — they are not company staff jobs.'
        : section === 'staff'
          ? 'People invited into one or more companies.'
          : section === 'unused'
            ? 'Logins with no company left. Safe to delete if you do not need them.'
            : 'Customer portal logins — managed under Customers, not company staff.'

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

      <div className="relative grid min-h-[36rem] lg:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)]">
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
                placeholder="Search name, email, or company"
                aria-label="Search system users"
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
                  { value: 'all', label: 'All', count: counts.all },
                  { value: 'platform', label: 'Platform', count: counts.platform },
                  { value: 'staff', label: 'Company staff', count: counts.staff },
                  { value: 'unused', label: 'Unused', count: counts.unused },
                  { value: 'portal', label: 'Portal', count: counts.portal },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => {
                    autoSelected.current = true
                    setSection(chip.value)
                  }}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide uppercase transition-all',
                    section === chip.value
                      ? 'bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_var(--primary)]'
                      : 'bg-background/35 text-muted-foreground hover:bg-background/55 hover:text-foreground',
                  )}
                >
                  {chip.label}
                  <span className="ml-1 opacity-80">{chip.count}</span>
                </button>
              ))}
            </div>
            <p className="text-[0.7rem] leading-relaxed text-muted-foreground">{sectionCopy}</p>
            {section === 'unused' ? (
              <CleanupUnusedButton count={counts.unused} />
            ) : null}
          </div>

          <ul
            className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
            role="listbox"
            aria-label="System users"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                {section === 'unused'
                  ? 'No unused logins.'
                  : section === 'all'
                    ? 'No logins yet.'
                    : 'No logins in this group.'}
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
                      onClick={() => selectUser(row.id)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all duration-200',
                        active
                          ? 'bg-primary/12 shadow-[inset_3px_0_0_0_var(--primary)] ring-1 ring-primary/35'
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
                        {row.kind === 'platform' ? (
                          <span className="absolute -left-0.5 -top-0.5 flex size-2.5 items-center justify-center rounded-full bg-primary ring-2 ring-[color-mix(in_oklab,var(--card)_90%,black)]">
                            <ShieldIcon className="size-1.5 text-primary-foreground" />
                          </span>
                        ) : null}
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
                          {row.kind === 'platform' ? (
                            <span className="rounded bg-primary/15 px-1 py-px text-[0.6rem] font-semibold text-primary uppercase">
                              needed
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {companyHint(row)} · {row.lastActiveLabel}
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
            <SystemUserPanel
              key={selected.id}
              user={selected}
              companies={companies}
              roles={roles}
              report={report}
              onClose={() => selectUser(null)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UsersIcon className="size-7" />
              </div>
              <p className="text-base font-semibold tracking-tight">Select a login</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Platform logins stay separate. Unused logins can be cleaned up in one step.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
