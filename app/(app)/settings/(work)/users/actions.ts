'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { cuid } from '@/lib/validation/common'
import {
  adminDisableMemberTwoFactorSchema,
  adminUpdateMemberIdentitySchema,
  inviteUserSchema,
  resetMemberPasswordSchema,
  updateMemberRoleSchema,
} from '@/lib/validation/user'
import { action } from '@/server/action'
import * as auth2fa from '@/server/services/auth-2fa.service'
import * as membershipService from '@/server/services/membership.service'

function revalidateMemberPaths(membershipId?: string) {
  revalidatePath('/settings/users')
  if (membershipId) revalidatePath(`/settings/users/${membershipId}`)
}

export const inviteUser = action
  .requires('user:invite')
  .input(inviteUserSchema)
  .handler(async (ctx, input) => {
    const member = await membershipService.invite(ctx, input)
    revalidateMemberPaths(member.id)
    return { id: member.id }
  })

export const updateMemberAccess = action
  .requires('user:update')
  .input(updateMemberRoleSchema)
  .handler(async (ctx, input) => {
    await membershipService.updateAccess(ctx, input)
    revalidateMemberPaths(input.membershipId)
    return { id: input.membershipId }
  })

/** @deprecated Prefer updateMemberAccess */
export const updateMemberRole = updateMemberAccess

export const setMemberStatus = action
  .requires('user:update')
  .input(z.object({ membershipId: cuid, status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']) }))
  .handler(async (ctx, input) => {
    await membershipService.setStatus(ctx, input.membershipId, input.status)
    revalidateMemberPaths(input.membershipId)
    return { id: input.membershipId }
  })

export const setMemberConnect = action
  .requires('user:update')
  .input(z.object({ membershipId: cuid, canConnect: z.boolean() }))
  .handler(async (ctx, input) => {
    await membershipService.setCanConnect(ctx, input.membershipId, input.canConnect)
    revalidateMemberPaths(input.membershipId)
    return { id: input.membershipId }
  })

export const removeMember = action
  .requires('user:remove')
  .input(z.object({ membershipId: cuid }))
  .handler(async (ctx, input) => {
    await membershipService.remove(ctx, input.membershipId)
    revalidateMemberPaths(input.membershipId)
    return { id: input.membershipId }
  })

export const resetMemberPassword = action
  .requires('user:update')
  .input(resetMemberPasswordSchema)
  .handler(async (ctx, input) => {
    const result = await membershipService.resetMemberPassword(ctx, input)
    revalidateMemberPaths(input.membershipId)
    return result
  })

export const adminDisableMemberTwoFactor = action
  .requires('user:update')
  .input(adminDisableMemberTwoFactorSchema)
  .handler(async (ctx, input) => {
    const result = await auth2fa.adminDisableMemberTwoFactor(ctx, input.membershipId)
    revalidateMemberPaths(input.membershipId)
    return result
  })

export const forceSignOutMember = action
  .requires('user:update')
  .input(z.object({ membershipId: cuid }))
  .handler(async (ctx, input) => {
    const result = await membershipService.forceSignOutMember(ctx, input.membershipId)
    revalidateMemberPaths(input.membershipId)
    return result
  })

export const adminUpdateMemberIdentity = action
  .requires('user:update')
  .input(adminUpdateMemberIdentitySchema)
  .handler(async (ctx, input) => {
    const result = await membershipService.adminUpdateMemberIdentity(ctx, input)
    revalidateMemberPaths(input.membershipId)
    revalidatePath('/settings/user-performance')
    return result
  })

/* --- form adapters ------------------------------------------------------- */

function parseInviteForm(raw: Record<string, FormDataEntryValue | undefined>) {
  let permissionsOverride: string[] = []
  const rawPerms = raw.permissionsOverride
  if (typeof rawPerms === 'string' && rawPerms.trim()) {
    try {
      const parsed = JSON.parse(rawPerms) as unknown
      if (Array.isArray(parsed)) {
        permissionsOverride = parsed.filter((p): p is string => typeof p === 'string')
      }
    } catch {
      permissionsOverride = []
    }
  }
  return {
    name: raw.name,
    email: raw.email,
    role: raw.role,
    temporaryPassword: raw.temporaryPassword,
    permissionsOverride,
  }
}

export async function inviteUserForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await inviteUser(parseInviteForm(formValues(formData)))
  return toFormState(result, 'Member added.')
}

export async function resetMemberPasswordForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData)
  const result = await resetMemberPassword({
    membershipId: raw.membershipId,
    temporaryPassword: raw.temporaryPassword,
  })
  if (!result.ok) return toFormState(result, '')
  return {
    status: 'success',
    message: `New password set for ${result.data.name}.`,
    temporaryPassword: result.data.temporaryPassword,
    created: { id: result.data.id, label: result.data.email },
  }
}
