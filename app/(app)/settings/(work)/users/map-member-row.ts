import type { Role } from '@prisma/client'

import { formatDateTime } from '@/lib/date'
import { appsOpenFor } from '@/lib/member-apps'
import {
  isUserOnline,
  presenceActivityLabel,
  presenceLabel,
} from '@/lib/presence'
import { membershipStatusLabel, ROLE_LABELS } from '@/lib/roles'
import { effectivePermissions } from '@/server/auth/permissions'
import type { OrgContext } from '@/server/auth/context'
import type { MemberRow } from '@/server/services/membership.service'
import type { UsersTableRow } from './users-table'

export function mapMemberRow(
  member: MemberRow,
  ctx: OrgContext,
  canUpdate: boolean,
  canRemove: boolean,
): UsersTableRow {
  const isSelf = member.user.id === ctx.userId
  const isOwner = member.role === 'OWNER'
  const perms = effectivePermissions(member.role as Role, member.permissionsOverride)
  const apps = appsOpenFor(perms)
  const canManageRow = (canUpdate || canRemove) && !isOwner && !isSelf
  const customCount = member.permissionsOverride.length
  const hasCustom = customCount > 0 || member.role === 'CUSTOM'
  const online = isUserOnline(member.user.lastSeenAt)

  return {
    id: member.id,
    role: member.role,
    status: member.status,
    permissionsOverride: member.permissionsOverride,
    canConnect: member.canConnect,
    isSelf,
    isOwner,
    canManageRow,
    showConnectToggle: ctx.isSystemOwner && member.role === 'ADMIN',
    name: member.user.name,
    email: member.user.email,
    phone: member.user.phone,
    userId: member.user.id,
    roleLabel: ROLE_LABELS[member.role],
    statusLabel: membershipStatusLabel(member.status),
    statusVariant:
      member.status === 'ACTIVE'
        ? 'success'
        : member.status === 'SUSPENDED'
          ? 'destructive'
          : 'warning',
    customPermissionNote: hasCustom
      ? `${customCount} custom permission${customCount === 1 ? '' : 's'}`
      : null,
    canConnectNote: member.canConnect && member.role === 'ADMIN',
    apps,
    online,
    presenceLabel: presenceLabel(online),
    lastActiveLabel: presenceActivityLabel(member.user.lastSeenAt),
    lastLoginLabel: member.user.lastLoginAt
      ? formatDateTime(member.user.lastLoginAt, ctx.organization.timeZone)
      : '—',
  }
}
