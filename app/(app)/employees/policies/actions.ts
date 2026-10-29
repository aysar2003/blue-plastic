'use server'

import { revalidatePath } from 'next/cache'

import {
  hrPolicyCreateSchema,
  hrPolicyIdSchema,
  hrPolicyUpdateSchema,
} from '@/lib/validation/hr-suite'
import { action } from '@/server/action'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { readHrUpload } from '@/server/files/employee-hr-files'
import * as hrPolicyService from '@/server/services/hr-policy.service'

function revalidatePolicies(id?: string) {
  revalidatePath('/employees/policies')
  if (id) revalidatePath(`/employees/policies/${id}`)
}

export const createHrPolicy = action
  .requires('hr:update')
  .input(hrPolicyCreateSchema)
  .handler(async (ctx, input) => {
    const row = await hrPolicyService.create(ctx, input)
    revalidatePolicies(row.id)
    return row
  })

export const updateHrPolicy = action
  .requires('hr:update')
  .input(hrPolicyUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await hrPolicyService.update(ctx, id, rest)
    revalidatePolicies(id)
    return row
  })

export const deleteHrPolicy = action
  .requires('hr:update')
  .input(hrPolicyIdSchema)
  .handler(async (ctx, input) => {
    await hrPolicyService.remove(ctx, input.id)
    revalidatePolicies()
    return { id: input.id }
  })

export async function uploadHrPolicyFile(formData: FormData) {
  try {
    const ctx = await requireOrgContext('hr:update')
    const id = String(formData.get('id') ?? '')
    const file = readHrUpload(formData)
    if (!id || !file) {
      return { ok: false as const, error: { message: 'Policy and file are required.' } }
    }
    await hrPolicyService.uploadFile(ctx, id, file)
    revalidatePolicies(id)
    return { ok: true as const, data: { id } }
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false as const, error: { message: error.message } }
    }
    return { ok: false as const, error: { message: 'Upload failed.' } }
  }
}
