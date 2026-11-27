import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { formatDateTime } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { ASSIGNABLE_ROLES } from '@/lib/roles'
import { permissionsFor } from '@/server/auth/permissions'
import * as membershipService from '@/server/services/membership.service'
import * as userHistoryService from '@/server/services/user-history.service'
import { mapMemberRow } from '../map-member-row'
import { MemberProfile } from '../member-profile'

const ROLE_TEMPLATES = Object.fromEntries(
  ASSIGNABLE_ROLES.map((role) => [role, [...permissionsFor(role)]]),
) as Record<string, string[]>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ membershipId: string }>
}): Promise<Metadata> {
  const { membershipId } = await params
  try {
    const ctx = await requireOrgContext('user:read')
    const member = await membershipService.get(ctx, membershipId)
    return { title: member.user.name }
  } catch {
    return { title: 'Member' }
  }
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ membershipId: string }>
}) {
  const ctx = await requireOrgContext('user:read')
  const { membershipId } = await params

  const member = await membershipService.get(ctx, membershipId).catch(() => null)
  if (!member) notFound()

  const canUpdate = ctx.permissions.has('user:update')
  const canRemove = ctx.permissions.has('user:remove')
  const row = mapMemberRow(member, ctx, canUpdate, canRemove)

  const historyResult = await userHistoryService.list(ctx, {
    page: 1,
    pageSize: 20,
    dir: 'desc',
    userId: member.user.id,
    action: null,
  })

  const history = historyResult.rows.map((item) => ({
    id: item.id,
    action: item.actionLabel,
    entity: item.entityLabel,
    atLabel: formatDateTime(item.at, ctx.organization.timeZone),
    href: item.href,
  }))

  return (
    <MemberProfile
      member={row}
      roles={[...ASSIGNABLE_ROLES]}
      roleTemplates={ROLE_TEMPLATES}
      canUpdate={canUpdate}
      canRemove={canRemove}
      history={history}
      backHref={`/settings/users?member=${member.id}`}
    />
  )
}
