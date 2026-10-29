'use server'

import { revalidatePath } from 'next/cache'

import {
  employeeContractCreateSchema,
  employeeContractIdSchema,
  employeeContractSetStateSchema,
  employeeContractUpdateSchema,
  employeeDocumentCreateSchema,
  employeeDocumentIdSchema,
} from '@/lib/validation/employee-hr'
import { action } from '@/server/action'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { readHrUpload } from '@/server/files/employee-hr-files'
import * as hrService from '@/server/services/employee-hr.service'

function revalidateHr(employeeId?: string) {
  revalidatePath('/employees')
  revalidatePath('/employees/contracts')
  if (employeeId) revalidatePath(`/employees/${employeeId}`)
}

export const createEmployeeContract = action
  .requires('hr:update')
  .input(employeeContractCreateSchema)
  .handler(async (ctx, input) => {
    const row = await hrService.createContract(ctx, input)
    revalidateHr(input.employeeId)
    return { id: row.id, employeeId: row.employeeId }
  })

export const updateEmployeeContract = action
  .requires('hr:update')
  .input(employeeContractUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await hrService.updateContract(ctx, id, rest)
    revalidateHr(row.employeeId)
    return { id: row.id }
  })

export const setEmployeeContractState = action
  .requires('hr:update')
  .input(employeeContractSetStateSchema)
  .handler(async (ctx, input) => {
    const result = await hrService.setContractState(ctx, input.id, input.state, input.syncWage)
    revalidateHr()
    return result
  })

export const deleteEmployeeContract = action
  .requires('hr:update')
  .input(employeeContractIdSchema)
  .handler(async (ctx, input) => {
    await hrService.removeContract(ctx, input.id)
    revalidateHr()
    return { id: input.id }
  })

export async function uploadEmployeeContractFile(formData: FormData) {
  try {
    const ctx = await requireOrgContext('hr:update')
    const id = String(formData.get('id') ?? '')
    const file = readHrUpload(formData)
    if (!id || !file) {
      return { ok: false as const, error: { message: 'Contract and file are required.' } }
    }
    await hrService.uploadContractPdf(ctx, id, file)
    revalidateHr()
    return { ok: true as const, data: { id } }
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false as const, error: { message: error.message } }
    }
    return { ok: false as const, error: { message: 'Upload failed.' } }
  }
}

export async function uploadEmployeeDocument(formData: FormData) {
  try {
    const ctx = await requireOrgContext('hr:update')
    const employeeId = String(formData.get('employeeId') ?? '')
    const title = String(formData.get('title') ?? '').trim() || 'Document'
    const kindRaw = String(formData.get('kind') ?? 'OTHER')
    const notesRaw = String(formData.get('notes') ?? '')
    const file = readHrUpload(formData)
    if (!employeeId || !file) {
      return { ok: false as const, error: { message: 'Employee and file are required.' } }
    }
    const parsed = employeeDocumentCreateSchema.safeParse({
      employeeId,
      title,
      kind: kindRaw,
      notes: notesRaw || null,
    })
    if (!parsed.success) {
      return { ok: false as const, error: { message: parsed.error.issues[0]?.message ?? 'Invalid' } }
    }
    const row = await hrService.uploadDocument(ctx, parsed.data, file)
    revalidateHr(employeeId)
    return { ok: true as const, data: { id: row.id } }
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false as const, error: { message: error.message } }
    }
    return { ok: false as const, error: { message: 'Upload failed.' } }
  }
}

export const deleteEmployeeDocument = action
  .requires('hr:update')
  .input(employeeDocumentIdSchema)
  .handler(async (ctx, input) => {
    await hrService.removeDocument(ctx, input.employeeId, input.id)
    revalidateHr(input.employeeId)
    return { id: input.id }
  })
