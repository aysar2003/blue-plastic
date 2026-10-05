'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { cuid } from '@/lib/validation/common'
import { inviteUserSchema, updateMemberRoleSchema } from '@/lib/validation/user'
import { action } from '@/server/action'
import * as membershipService from '@/server/services/membership.service'

export const inviteUser = action
  .requires('user:invite')
  .input(inviteUserSchema)
  .handler(async (ctx, input) => {
    const member = await membershipService.invite(ctx, input)
    revalidatePath('/settings/users')
    return { id: member.id }
  })

export const updateMemberAccess = action
  .requires('user:update')
  .input(updateMemberRoleSchema)
  .handler(async (ctx, input) => {
    await membershipService.updateAccess(ctx, input)
    revalidatePath('/settings/users')
    return { id: input.membershipId }
  })

/** @deprecated Prefer updateMemberAccess */
export const updateMemberRole = updateMemberAccess

export const setMemberStatus = action
  .requires('user:update')
  .input(z.object({ membershipId: cuid, status: z.enum(['ACTIVE', 'SUSPENDED']) }))
  .handler(async (ctx, input) => {
    await membershipService.setStatus(ctx, input.membershipId, input.status)
    revalidatePath('/settings/users')
    return { id: input.membershipId }
  })

export const removeMember = action
  .requires('user:remove')
  .input(z.object({ membershipId: cuid }))
  .handler(async (ctx, input) => {
    await membershipService.remove(ctx, input.membershipId)
    revalidatePath('/settings/users')
    return { id: input.membershipId }
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
