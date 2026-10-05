import { z } from 'zod'

import { PERMISSIONS } from '@/lib/permissions-catalog'
import { cuid, email, password, requiredText } from './common'

const assignableOrCustom = z.enum([
  'ADMIN',
  'ACCOUNTANT',
  'BOOKKEEPER',
  'SALES',
  'STORE_KEEPER',
  'VIEWER',
  'CUSTOM',
])

const permissionKey = z.enum(PERMISSIONS as unknown as [string, ...string[]])

const permissionsOverrideSchema = z.array(permissionKey).max(PERMISSIONS.length)

/**
 * Invite: either a ready-made role (permissionsOverride empty) or manual access
 * (role CUSTOM + at least one permission).
 */
export const inviteUserSchema = z
  .object({
    name: requiredText('Name', 120),
    email,
    role: assignableOrCustom,
    permissionsOverride: permissionsOverrideSchema.default([]),
    /**
     * Email delivery does not exist yet, so an invited user is created with a
     * password set by the inviter. Phase 10 replaces this with a signed invitation
     * link; the shape of this action does not change.
     */
    temporaryPassword: password,
  })
  .superRefine((value, ctx) => {
    if (value.role === 'CUSTOM' && value.permissionsOverride.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['permissionsOverride'],
        message: 'Choose at least one permission for custom access.',
      })
    }
  })

export type InviteUserInput = z.infer<typeof inviteUserSchema>

export const updateMemberRoleSchema = z
  .object({
    membershipId: cuid,
    role: assignableOrCustom,
    permissionsOverride: permissionsOverrideSchema.default([]),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'CUSTOM' && value.permissionsOverride.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['permissionsOverride'],
        message: 'Choose at least one permission for custom access.',
      })
    }
  })

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>

export const membershipIdSchema = z.object({ membershipId: cuid })

export const updateProfileSchema = z.object({
  name: requiredText('Name', 120),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
