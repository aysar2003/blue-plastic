'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { cuid } from '@/lib/validation/common'
import { resetSystemUserPasswordSchema } from '@/lib/validation/user'
import { action } from '@/server/action'
import { forbidden } from '@/server/errors'
import * as userService from '@/server/services/user.service'

const staffRoleSchema = z.enum([
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'BOOKKEEPER',
  'SALES_MANAGER',
  'SALES',
  'AR_CLERK',
  'PURCHASING_MANAGER',
  'PURCHASING',
  'AP_CLERK',
  'BANK_CLERK',
  'POS_SUPERVISOR',
  'CASHIER',
  'WAREHOUSE_MANAGER',
  'STORE_KEEPER',
  'PROJECT_MANAGER',
  'MASTER_DATA',
  'AUDITOR',
  'VIEWER',
])

export const resetSystemUserPassword = action
  .requires('org:update')
  .input(resetSystemUserPasswordSchema)
  .handler(async (ctx, input) => {
    if (!ctx.isSystemOwner) {
      throw forbidden('Only the system owner can reset passwords across companies.')
    }
    const result = await userService.adminResetPassword(ctx, input)
    revalidatePath('/databases/users')
    return result
  })

export const setSystemUserStatus = action
  .requires('org:update')
  .input(z.object({ userId: cuid, status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']) }))
  .handler(async (ctx, input) => {
    if (!ctx.isSystemOwner) {
      throw forbidden('Only the system owner can change a login across companies.')
    }
    const result = await userService.setSystemUserStatus(ctx, input.userId, input.status)
    revalidatePath('/databases/users')
    revalidatePath('/settings/users')
    return result
  })

export const deleteSystemUser = action
  .requires('org:update')
  .input(z.object({ userId: cuid }))
  .handler(async (ctx, input) => {
    if (!ctx.isSystemOwner) {
      throw forbidden('Only the system owner can delete a login.')
    }
    const result = await userService.deleteSystemUser(ctx, input.userId)
    revalidatePath('/databases/users')
    revalidatePath('/settings/users')
    return result
  })

export const deleteUnusedSystemUsers = action
  .requires('org:update')
  .handler(async (ctx) => {
    if (!ctx.isSystemOwner) {
      throw forbidden('Only the system owner can clean unused logins.')
    }
    const result = await userService.deleteUnusedSystemUsers(ctx)
    revalidatePath('/databases/users')
    revalidatePath('/settings/users')
    return result
  })

export const forceSignOutSystemUser = action
  .requires('org:update')
  .input(z.object({ userId: cuid }))
  .handler(async (ctx, input) => {
    if (!ctx.isSystemOwner) {
      throw forbidden('Only the system owner can force sign-out across companies.')
    }
    const result = await userService.forceSignOutUser(ctx, input.userId)
    revalidatePath('/databases/users')
    return result
  })

export const disableSystemUserTwoFactor = action
  .requires('org:update')
  .input(z.object({ userId: cuid }))
  .handler(async (ctx, input) => {
    if (!ctx.isSystemOwner) {
      throw forbidden('Only the system owner can turn off two-factor across companies.')
    }
    const result = await userService.adminDisableUserTwoFactor(ctx, input.userId)
    revalidatePath('/databases/users')
    return result
  })

export const addSystemUserToCompany = action
  .requires('org:update')
  .input(z.object({ userId: cuid, orgId: cuid, role: staffRoleSchema }))
  .handler(async (ctx, input) => {
    if (!ctx.isSystemOwner) {
      throw forbidden('Only the system owner can add people to any company.')
    }
    const result = await userService.addUserToCompany(ctx, input)
    revalidatePath('/databases/users')
    revalidatePath('/settings/users')
    return result
  })

export async function resetSystemUserPasswordForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData)
  const result = await resetSystemUserPassword({
    userId: raw.userId,
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
