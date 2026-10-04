'use server'

import { revalidatePath } from 'next/cache'
import type { Role } from '@prisma/client'
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

export const updateMemberRole = action
  .requires('user:update')
  .input(updateMemberRoleSchema)
  .handler(async (ctx, input) => {
    await membershipService.updateRole(ctx, input.membershipId, input.role as Role)
    revalidatePath('/settings/users')
    return { id: input.membershipId }
  })

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

export async function inviteUserForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await inviteUser(formValues(formData))
  return toFormState(result, 'Member added.')
}
