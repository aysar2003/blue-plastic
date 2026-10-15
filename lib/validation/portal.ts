import { z } from 'zod'

import { cuid, email, password, requiredText } from './common'

const invitePortalUserBase = {
  customerId: cuid,
  name: requiredText('Name', 120),
  email,
}

/** Staff invite — password (login ready) or link (customer chooses password). */
export const invitePortalUserSchema = z.discriminatedUnion('inviteMode', [
  z.object({
    ...invitePortalUserBase,
    inviteMode: z.literal('password'),
    temporaryPassword: password,
  }),
  z.object({
    ...invitePortalUserBase,
    inviteMode: z.literal('link'),
    temporaryPassword: z.string().optional(),
  }),
])

export type InvitePortalUserInput = z.infer<typeof invitePortalUserSchema>

/** Parse form/API payloads that may omit inviteMode (defaults to password). */
export function parseInvitePortalUserInput(raw: unknown) {
  const data =
    raw && typeof raw === 'object'
      ? {
          ...(raw as Record<string, unknown>),
          inviteMode:
            (raw as { inviteMode?: unknown }).inviteMode === 'link' ? 'link' : 'password',
        }
      : raw
  return invitePortalUserSchema.safeParse(data)
}

export const portalMembershipIdSchema = z.object({
  membershipId: cuid,
})

export const resetPortalPasswordSchema = z.object({
  membershipId: cuid,
  temporaryPassword: password,
})

export type ResetPortalPasswordInput = z.infer<typeof resetPortalPasswordSchema>

/** Public accept form — the customer chooses their password. */
export const acceptPortalInviteSchema = z
  .object({
    token: z.string().min(10, 'Invite link is missing or incomplete.'),
    name: requiredText('Name', 120),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type AcceptPortalInviteInput = z.infer<typeof acceptPortalInviteSchema>
