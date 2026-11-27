'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MemberManagePanel } from './member-manage-panel'
import { EditMemberAccessDialog } from './edit-member-access-dialog'
import { presenceDotClass } from '@/lib/presence'
import {
  memberAvatarClass,
  memberAvatarStyle,
  memberInitials,
} from './member-ui'
import type { UsersTableRow } from './users-table'

type TabId = 'profile' | 'access' | 'security' | 'history'

export type MemberHistoryItem = {
  id: string
  action: string
  entity: string
  atLabel: string
  href: string | null
}

export function MemberProfile({
  member,
  roles,
  roleTemplates,
  canUpdate,
  canRemove,
  history,
  backHref,
}: {
  member: UsersTableRow
  roles: string[]
  roleTemplates: Record<string, string[]>
  canUpdate: boolean
  canRemove: boolean
  history: MemberHistoryItem[]
  backHref: string
}) {
  const [tab, setTab] = useState<TabId>('profile')
  const [editOpen, setEditOpen] = useState(false)

  const tabs = useMemo(
    () =>
      [
        { id: 'profile' as const, label: 'Profile' },
        { id: 'access' as const, label: 'Access' },
        { id: 'security' as const, label: 'Security' },
        { id: 'history' as const, label: 'History' },
      ] as const,
    [],
  )

  return (
    <div className="space-y-4">
      <Button type="button" size="sm" variant="ghost" className="rounded-xl" asChild>
        <Link href={backHref}>
          <ArrowLeftIcon className="size-3.5" />
          Company users
        </Link>
      </Button>

      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-border/70',
          'bg-[linear-gradient(165deg,color-mix(in_oklab,var(--card)_90%,var(--primary)_10%),var(--card)_48%)]',
          'shadow-[0_24px_60px_-36px_rgb(0_0_0/0.55)]',
        )}
      >
        <div className="relative overflow-hidden border-b border-border/50 px-5 py-6 sm:px-7">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--primary)_24%,transparent),transparent_55%)]"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="relative w-fit">
              <Avatar className={memberAvatarClass('lg')} style={memberAvatarStyle(member.name)}>
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
                  'absolute right-1 bottom-1 size-3.5 rounded-full ring-2 ring-[color-mix(in_oklab,var(--card)_92%,black)]',
                  presenceDotClass(member.online),
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{member.name}</h1>
                {member.isSelf ? (
                  <span className="rounded-md bg-background/50 px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground uppercase">
                    you
                  </span>
                ) : null}
                <span
                  className={cn(
                    'rounded-lg px-2 py-0.5 text-xs font-semibold',
                    member.online
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {member.presenceLabel}
                </span>
                <span className="rounded-lg bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
                  {member.statusLabel}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Role{' '}
                <span className="font-semibold text-foreground">{member.roleLabel}</span>
                {member.customPermissionNote ? ` · ${member.customPermissionNote}` : ''}
              </p>
            </div>
            {canUpdate && member.canManageRow ? (
              <Button type="button" size="sm" className="rounded-xl" onClick={() => setEditOpen(true)}>
                Manage access
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex gap-1 border-b border-border/50 px-3 pt-2 sm:px-5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'relative rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition-colors',
                tab === item.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              {tab === item.id ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="animate-in fade-in-0 duration-200">
          {tab === 'profile' ? (
            <MemberManagePanel
              member={member}
              roles={roles}
              roleTemplates={roleTemplates}
              canUpdate={canUpdate}
              canRemove={canRemove}
              compact
              sections={['profile']}
            />
          ) : tab === 'access' ? (
            <MemberManagePanel
              member={member}
              roles={roles}
              roleTemplates={roleTemplates}
              canUpdate={canUpdate}
              canRemove={canRemove}
              compact
              sections={['access']}
            />
          ) : tab === 'security' ? (
            <MemberManagePanel
              member={member}
              roles={roles}
              roleTemplates={roleTemplates}
              canUpdate={canUpdate}
              canRemove={canRemove}
              compact
              sections={['status', 'security', 'danger']}
            />
          ) : (
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Recent sign-in and work for this person.
                </p>
                <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                  <Link href={`/settings/user-history?userId=${member.userId}`}>Full history</Link>
                </Button>
              </div>
              {history.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No history recorded yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-background/30">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {item.action}
                          <span className="font-normal text-muted-foreground"> · {item.entity}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{item.atLabel}</p>
                      </div>
                      {item.href ? (
                        <Button type="button" size="sm" variant="ghost" className="rounded-xl" asChild>
                          <Link href={item.href}>Open</Link>
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {canUpdate && member.canManageRow ? (
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
      ) : null}
    </div>
  )
}
