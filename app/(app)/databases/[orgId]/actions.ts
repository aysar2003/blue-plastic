'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { cuid } from '@/lib/validation/common'
import {
  inviteUserSchema,
  resetMemberPasswordSchema,
  updateMemberRoleSchema,
} from '@/lib/validation/user'
import { deleteCompanySchema } from '@/lib/validation/company'
import { action } from '@/server/action'
import { requireOrgContext } from '@/server/auth/context'
import { forbidden } from '@/server/errors'
import * as companyAgreementService from '@/server/services/company-agreement.service'
import * as companyService from '@/server/services/company.service'
import {
  asCompanyContext,
  canManageCompanyUsers,
} from '@/server/services/company-database.service'
import * as membershipService from '@/server/services/membership.service'

function revalidateCompany(orgId: string) {
  revalidatePath('/databases')
  revalidatePath(`/databases/${orgId}`)
  revalidatePath('/databases/users')
  revalidatePath('/settings/users')
}

async function requireManage(ctx: Parameters<typeof canManageCompanyUsers>[0], orgId: string) {
  if (!canManageCompanyUsers(ctx, orgId)) {
    throw forbidden('You cannot manage users for this company from here.')
  }
  return asCompanyContext(ctx, orgId)
}

export const inviteCompanyUser = action
  .requires('org:update')
  .input(z.object({ orgId: cuid }).and(inviteUserSchema))
  .handler(async (ctx, input) => {
    const { orgId, ...rest } = input
    const companyCtx = await requireManage(ctx, orgId)
    const member = await membershipService.invite(companyCtx, rest)
    revalidateCompany(orgId)
    return { id: member.id, orgId }
  })

export const updateCompanyMemberAccess = action
  .requires('org:update')
  .input(z.object({ orgId: cuid }).and(updateMemberRoleSchema))
  .handler(async (ctx, input) => {
    const { orgId, ...rest } = input
    const companyCtx = await requireManage(ctx, orgId)
    await membershipService.updateAccess(companyCtx, rest)
    revalidateCompany(orgId)
    return { id: input.membershipId, orgId }
  })

export const setCompanyMemberStatus = action
  .requires('org:update')
  .input(
    z.object({
      orgId: cuid,
      membershipId: cuid,
      status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']),
    }),
  )
  .handler(async (ctx, input) => {
    const companyCtx = await requireManage(ctx, input.orgId)
    await membershipService.setStatus(companyCtx, input.membershipId, input.status)
    revalidateCompany(input.orgId)
    return { id: input.membershipId }
  })

export const setCompanyMemberConnect = action
  .requires('org:update')
  .input(z.object({ orgId: cuid, membershipId: cuid, canConnect: z.boolean() }))
  .handler(async (ctx, input) => {
    if (!ctx.isSystemOwner) {
      throw forbidden('Only the system owner can allow Connect.')
    }
    const companyCtx = asCompanyContext(ctx, input.orgId)
    await membershipService.setCanConnect(companyCtx, input.membershipId, input.canConnect)
    revalidateCompany(input.orgId)
    return { id: input.membershipId }
  })

export const removeCompanyMember = action
  .requires('org:update')
  .input(z.object({ orgId: cuid, membershipId: cuid }))
  .handler(async (ctx, input) => {
    const companyCtx = await requireManage(ctx, input.orgId)
    await membershipService.remove(companyCtx, input.membershipId)
    revalidateCompany(input.orgId)
    return { id: input.membershipId }
  })

export const resetCompanyMemberPassword = action
  .requires('org:update')
  .input(z.object({ orgId: cuid }).and(resetMemberPasswordSchema))
  .handler(async (ctx, input) => {
    const { orgId, ...rest } = input
    const companyCtx = await requireManage(ctx, orgId)
    const result = await membershipService.resetMemberPassword(companyCtx, rest)
    revalidateCompany(orgId)
    return result
  })

export async function inviteCompanyUserForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData)
  let permissionsOverride: string[] = []
  if (typeof raw.permissionsOverride === 'string' && raw.permissionsOverride.trim()) {
    try {
      const parsed = JSON.parse(raw.permissionsOverride) as unknown
      if (Array.isArray(parsed)) permissionsOverride = parsed.filter((v) => typeof v === 'string')
    } catch {
      permissionsOverride = []
    }
  }
  const result = await inviteCompanyUser({
    orgId: raw.orgId,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    temporaryPassword: raw.temporaryPassword,
    permissionsOverride,
  })
  if (!result.ok) return toFormState(result, '')
  return toFormState(result, 'User invited to this company.')
}

export async function resetCompanyMemberPasswordForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData)
  const result = await resetCompanyMemberPassword({
    orgId: raw.orgId,
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

export const deleteCompanyFromDetail = action
  .requires('org:update')
  .input(deleteCompanySchema)
  .handler(async (ctx, input) => {
    const result = await companyService.deleteCompany(ctx, input)
    revalidatePath('/databases')
    return result
  })

export const createCompanyAgreement = action
  .requires('org:update')
  .input(
    z.object({
      orgId: cuid,
      title: z.string().min(1).max(200),
      status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']).default('DRAFT'),
      startsOn: z.string().optional().nullable(),
      endsOn: z.string().optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
    }),
  )
  .handler(async (ctx, input) => {
    if (!ctx.isSystemOwner) throw forbidden('Only the system owner can add agreements.')
    const result = await companyAgreementService.create(ctx, input)
    revalidateCompany(input.orgId)
    return result
  })

export async function createCompanyAgreementForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const orgId = String(formData.get('orgId') ?? '')
  const fileEntry = formData.get('file')
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null
  try {
    const ctx = await requireOrgContext('org:update')
    if (!ctx.isSystemOwner) {
      return { status: 'error', message: 'Only the system owner can add agreements.' }
    }
    await companyAgreementService.create(ctx, {
      orgId,
      title: String(formData.get('title') ?? ''),
      status: (String(formData.get('status') ?? 'DRAFT') as 'DRAFT' | 'ACTIVE' | 'ENDED') || 'DRAFT',
      startsOn: String(formData.get('startsOn') ?? '') || null,
      endsOn: String(formData.get('endsOn') ?? '') || null,
      notes: String(formData.get('notes') ?? '') || null,
      file,
    })
    revalidateCompany(orgId)
    return { status: 'success', message: 'Agreement saved.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save agreement.'
    return { status: 'error', message }
  }
}

export const setCompanyAgreementStatus = action
  .requires('org:update')
  .input(
    z.object({
      orgId: cuid,
      agreementId: cuid,
      status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']),
    }),
  )
  .handler(async (ctx, input) => {
    await companyAgreementService.setStatus(ctx, input)
    revalidateCompany(input.orgId)
    return { id: input.agreementId }
  })

export const removeCompanyAgreement = action
  .requires('org:update')
  .input(z.object({ orgId: cuid, agreementId: cuid }))
  .handler(async (ctx, input) => {
    await companyAgreementService.remove(ctx, input)
    revalidateCompany(input.orgId)
    return { id: input.agreementId }
  })
