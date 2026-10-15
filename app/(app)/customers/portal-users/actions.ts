'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { portalLoginUrl } from '@/lib/portal-login'
import { cuid } from '@/lib/validation/common'
import {
  invitePortalUserSchema,
  parseInvitePortalUserInput,
  portalMembershipIdSchema,
  resetPortalPasswordSchema,
} from '@/lib/validation/portal'
import { action } from '@/server/action'
import * as portalService from '@/server/services/portal.service'

function revalidatePortalUsers() {
  revalidatePath('/customers/portal-users')
  revalidatePath('/customers')
}

async function requestOrigin(): Promise<string | null> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return null
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export const invitePortalUser = action
  .requires('portal:manage')
  .input(invitePortalUserSchema)
  .handler(async (ctx, input) => {
    const created = await portalService.invitePortalUser(ctx, input)
    const origin = await requestOrigin()
    revalidatePortalUsers()
    if (created.inviteMode === 'link' && created.inviteToken) {
      return {
        id: created.id,
        membershipId: created.membershipId,
        email: created.email,
        inviteMode: 'link' as const,
        inviteUrl: portalService.inviteUrlForToken(created.inviteToken, origin),
      }
    }
    return {
      id: created.id,
      membershipId: created.membershipId,
      email: created.email,
      inviteMode: 'password' as const,
      temporaryPassword: input.inviteMode === 'password' ? input.temporaryPassword : undefined,
      portalLoginUrl: portalLoginUrl(created.orgId, origin),
    }
  })

export const refreshPortalInvite = action
  .requires('portal:manage')
  .input(portalMembershipIdSchema)
  .handler(async (ctx, input) => {
    const refreshed = await portalService.refreshPortalInviteLink(ctx, input.membershipId)
    const origin = await requestOrigin()
    return {
      id: refreshed.membershipId,
      inviteUrl: portalService.inviteUrlForToken(refreshed.inviteToken, origin),
    }
  })

export const setPortalUserStatus = action
  .requires('portal:manage')
  .input(z.object({ membershipId: cuid, status: z.enum(['ACTIVE', 'SUSPENDED']) }))
  .handler(async (ctx, input) => {
    await portalService.setPortalUserStatus(ctx, input.membershipId, input.status)
    revalidatePortalUsers()
    return { id: input.membershipId }
  })

export const resetPortalPassword = action
  .requires('portal:manage')
  .input(resetPortalPasswordSchema)
  .handler(async (ctx, input) => {
    await portalService.resetPortalPassword(ctx, input)
    revalidatePortalUsers()
    return { id: input.membershipId }
  })

export const removePortalUser = action
  .requires('portal:manage')
  .input(portalMembershipIdSchema)
  .handler(async (ctx, input) => {
    await portalService.removePortalUser(ctx, input.membershipId)
    revalidatePortalUsers()
    return { id: input.membershipId }
  })

export async function invitePortalUserForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData)
  const parsed = parseInvitePortalUserInput({
    customerId: raw.customerId,
    name: raw.name,
    email: raw.email,
    inviteMode: raw.inviteMode || 'password',
    temporaryPassword: raw.temporaryPassword || undefined,
  })
  if (!parsed.success) {
    return toFormState(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Please correct the highlighted fields.',
          details: Object.fromEntries(
            Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [
              key,
              value ?? [],
            ]),
          ),
        },
      },
      '',
    )
  }
  const result = await invitePortalUser(parsed.data)
  if (!result.ok) return toFormState(result, '')
  if (result.data.inviteMode === 'link') {
    return {
      status: 'success',
      message: 'Invite link created. Copy it and send it to the customer so they can set a password.',
      created: { id: result.data.id },
      portalEmail: result.data.email,
      inviteUrl: result.data.inviteUrl,
    }
  }
  return {
    status: 'success',
    message: 'Portal login created. Copy the email, password, and login link for the customer.',
    created: { id: result.data.id },
    portalEmail: result.data.email,
    temporaryPassword: result.data.temporaryPassword,
    portalLoginUrl: result.data.portalLoginUrl,
  }
}

export async function resetPortalPasswordForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData)
  const parsed = resetPortalPasswordSchema.safeParse({
    membershipId: raw.membershipId,
    temporaryPassword: raw.temporaryPassword,
  })
  if (!parsed.success) {
    return toFormState(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Please correct the highlighted fields.',
          details: Object.fromEntries(
            Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [
              key,
              value ?? [],
            ]),
          ),
        },
      },
      '',
    )
  }
  const result = await resetPortalPassword(parsed.data)
  return toFormState(result, 'Password updated.')
}
