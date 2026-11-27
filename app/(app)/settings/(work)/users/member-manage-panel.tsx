'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ExternalLinkIcon,
  HistoryIcon,
  KeyRoundIcon,
  LogOutIcon,
  PencilIcon,
  ShieldOffIcon,
  TrendingUpIcon,
  UserMinusIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { ResetWorkPasswordDialog } from '@/components/settings/reset-work-password-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  PERFORMANCE_BAND_LABEL,
  performancePeriodLabel,
  type PerformanceBand,
  type PerformancePeriodDays,
} from '@/lib/user-performance'
import { cn } from '@/lib/utils'
import { ConnectToggle } from './connect-toggle'
import { EditMemberAccessDialog } from './edit-member-access-dialog'
import { EditMemberIdentityDialog } from './edit-member-identity-dialog'
import {
  adminDisableMemberTwoFactor,
  forceSignOutMember,
  removeMember,
  resetMemberPasswordForm,
  setMemberStatus,
} from './actions'
import { presenceDotClass } from '@/lib/presence'
import {
  memberAvatarClass,
  memberAvatarStyle,
  memberInitials,
} from './member-ui'
import type { UsersTableRow } from './users-table'

export type ManageSection = 'profile' | 'access' | 'status' | 'security' | 'more' | 'danger'

const ALL_SECTIONS: ManageSection[] = ['profile', 'access', 'status', 'security', 'more', 'danger']

export type MemberPerformanceStrip = {
  score: number
  band: PerformanceBand
  rank: number
}

function Section({
  title,
  children,
  tone = 'default',
}: {
  title: string
  children: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        tone === 'danger'
          ? 'border-destructive/25 bg-destructive/5'
          : 'border-border/60 bg-background/35 backdrop-blur-sm',
      )}
    >
      <h3
        className={cn(
          'mb-3 text-[0.7rem] font-semibold tracking-[0.14em] uppercase',
          tone === 'danger' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

export function MemberManagePanel({
  member,
  roles,
  roleTemplates,
  canUpdate,
  canRemove,
  compact = false,
  sections = ALL_SECTIONS,
  days = 30,
  performance,
  onClose,
}: {
  member: UsersTableRow
  roles: string[]
  roleTemplates: Record<string, string[]>
  canUpdate: boolean
  canRemove: boolean
  compact?: boolean
  sections?: ManageSection[]
  days?: PerformancePeriodDays
  performance?: MemberPerformanceStrip | null
  onClose?: () => void
}) {
  const show = (section: ManageSection) => sections.includes(section)
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const readOnly = !member.canManageRow
  const lockReason = member.isOwner
    ? 'Owner access is fixed. Transfer ownership to change this person.'
    : member.isSelf
      ? 'You cannot change your own access from here.'
      : null

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!compact ? (
        <div className="relative overflow-hidden border-b border-border/50 px-5 py-5 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_45%)]"
          />
          <div className="relative flex items-start gap-4">
            <span className="relative">
              <Avatar className={memberAvatarClass('md')} style={memberAvatarStyle(member.name)}>
                <AvatarFallback
                  className="bg-transparent text-inherit"
                  style={memberAvatarStyle(member.name)}
                >
                  {memberInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <span
                title={member.presenceLabel}
                className={cn(
                  'absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-[color-mix(in_oklab,var(--card)_92%,black)]',
                  presenceDotClass(member.online),
                )}
              />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold tracking-tight">{member.name}</h2>
                {member.isSelf ? (
                  <span className="rounded-md bg-background/50 px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground uppercase">
                    you
                  </span>
                ) : null}
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide',
                    member.online
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {member.presenceLabel}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{member.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
                  {member.roleLabel}
                </span>
                <span className="text-xs text-muted-foreground">{member.statusLabel}</span>
                {member.customPermissionNote ? (
                  <span className="text-xs text-muted-foreground">· {member.customPermissionNote}</span>
                ) : null}
              </div>
            </div>
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={onClose}
              >
                Back
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {lockReason && (show('access') || show('status') || show('security') || show('danger') || show('profile')) ? (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-100/90 dark:text-amber-100/90">
            {lockReason}
          </p>
        ) : null}

        {performance ? (
          <Section title={`Performance · ${performancePeriodLabel(days)}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold tracking-tight">
                  #{performance.rank} · {PERFORMANCE_BAND_LABEL[performance.band]}
                </p>
                <p className="text-xs text-muted-foreground">Score {performance.score}</p>
              </div>
              <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                <Link
                  href={
                    days === 30
                      ? `/settings/user-performance?user=${member.userId}`
                      : days === 0
                        ? `/settings/user-performance?user=${member.userId}&days=all`
                        : `/settings/user-performance?user=${member.userId}&days=${days}`
                  }
                >
                  <TrendingUpIcon className="size-3.5" />
                  Team performance
                </Link>
              </Button>
            </div>
          </Section>
        ) : null}

        {show('profile') ? (
          <Section title="Profile">
            <div className="mb-3 space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Name · </span>
                {member.name}
              </p>
              <p className="truncate">
                <span className="text-muted-foreground">Email · </span>
                {member.email}
              </p>
              <p>
                <span className="text-muted-foreground">Phone · </span>
                {member.phone?.trim() ? member.phone : '—'}
              </p>
            </div>
            {canUpdate && member.canManageRow ? (
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                disabled={pending}
                onClick={() => setIdentityOpen(true)}
              >
                <PencilIcon className="size-3.5" />
                Edit profile
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {member.isSelf
                  ? 'Edit your own name and phone under Settings → Your profile.'
                  : 'Profile edits need manage access.'}
              </p>
            )}
          </Section>
        ) : null}

        {show('access') ? (
          <Section title="Role & apps">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-semibold tracking-tight">{member.roleLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {member.apps.length === 0
                    ? 'No apps open'
                    : `${member.apps.length} app${member.apps.length === 1 ? '' : 's'} open`}
                </p>
              </div>
              {canUpdate && member.canManageRow ? (
                <Button type="button" size="sm" onClick={() => setEditOpen(true)}>
                  <KeyRoundIcon className="size-3.5" />
                  Manage access
                </Button>
              ) : null}
            </div>
            {member.apps.length > 0 ? (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {member.apps.slice(0, 10).map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/25 px-3 py-2"
                  >
                    <span className="truncate text-sm">{app.label}</span>
                    <span
                      aria-hidden
                      className="relative h-5 w-9 shrink-0 rounded-full bg-primary/25"
                    >
                      <span className="absolute top-0.5 right-0.5 size-4 rounded-full bg-primary shadow-sm" />
                    </span>
                  </div>
                ))}
                {member.apps.length > 10 ? (
                  <div className="flex items-center rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                    +{member.apps.length - 10} more apps — open Manage access to edit
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No apps assigned.</p>
            )}
            {member.showConnectToggle ? (
              <div className="mt-3">
                <ConnectToggle membershipId={member.id} enabled={member.canConnect} />
              </div>
            ) : null}
          </Section>
        ) : null}

        {show('status') ? (
          <Section title="Status">
            <div className="inline-flex rounded-xl border border-border/60 bg-background/30 p-1">
              {(
                [
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INVITED', label: 'Pending' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                ] as const
              ).map((option) => {
                const active = member.status === option.value
                const disabled = readOnly || !canUpdate || pending
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled || active}
                    onClick={() =>
                      run(
                        () => setMemberStatus({ membershipId: member.id, status: option.value }),
                        `${member.name} is ${option.label.toLowerCase()}.`,
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
          </Section>
        ) : null}

        {show('security') ? (
          <Section title="Security">
            {canUpdate && member.canManageRow ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => setResetOpen(true)}
                >
                  Reset password
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Force sign-out for ${member.name} on this company?`)) {
                      return
                    }
                    run(
                      () => forceSignOutMember({ membershipId: member.id }),
                      `${member.name} signed out of this company.`,
                    )
                  }}
                >
                  <LogOutIcon className="size-3.5" />
                  Force sign-out
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Turn off two-factor authentication for ${member.name}? They can sign in with password only until they set it up again.`,
                      )
                    ) {
                      return
                    }
                    run(
                      () => adminDisableMemberTwoFactor({ membershipId: member.id }),
                      `Two-factor turned off for ${member.name}.`,
                    )
                  }}
                >
                  <ShieldOffIcon className="size-3.5" />
                  Turn off 2FA
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Security actions need manage access.</p>
            )}
          </Section>
        ) : null}

        {show('more') ? (
          <Section title="More">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                <Link href={`/settings/users/${member.id}`}>
                  <ExternalLinkIcon className="size-3.5" />
                  Open full profile
                </Link>
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                <Link href={`/settings/user-history?userId=${member.userId}`}>
                  <HistoryIcon className="size-3.5" />
                  History
                </Link>
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                <Link href={`/settings/user-performance?user=${member.userId}`}>
                  <TrendingUpIcon className="size-3.5" />
                  Performance
                </Link>
              </Button>
            </div>
          </Section>
        ) : null}

        {show('danger') && canRemove && member.canManageRow ? (
          <Section title="Danger zone" tone="danger">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="rounded-xl"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Remove ${member.name} from this company?`)) return
                run(
                  () => removeMember({ membershipId: member.id }),
                  `${member.name} removed.`,
                  () => {
                    onClose?.()
                    if (pathname.startsWith(`/settings/users/${member.id}`)) {
                      router.push('/settings/users')
                    }
                  },
                )
              }}
            >
              <UserMinusIcon className="size-3.5" />
              Remove from company
            </Button>
          </Section>
        ) : null}

        {show('access') || show('status') ? (
          <p className="px-1 text-xs text-muted-foreground">
            {member.presenceLabel} · {member.lastActiveLabel}
            <span className="mx-1.5 text-border">·</span>
            Last signed in · {member.lastLoginLabel}
          </p>
        ) : null}
      </div>

      {canUpdate && member.canManageRow ? (
        <>
          <EditMemberIdentityDialog
            open={identityOpen}
            onOpenChange={setIdentityOpen}
            membershipId={member.id}
            initialName={member.name}
            initialEmail={member.email}
            initialPhone={member.phone}
          />
          <EditMemberAccessDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            membershipId={member.id}
            name={member.name}
            initialRole={member.role}
            initialPermissions={member.permissionsOverride}
            roles={roles}
            roleTemplates={roleTemplates}
          />
          <ResetWorkPasswordDialog
            open={resetOpen}
            onOpenChange={setResetOpen}
            title="Reset work password"
            description={`Set a new temporary password for ${member.name} (${member.email}). The old password is never shown — only this new one, once.`}
            hiddenFields={{ membershipId: member.id }}
            formAction={resetMemberPasswordForm}
          />
        </>
      ) : null}
    </div>
  )
}
