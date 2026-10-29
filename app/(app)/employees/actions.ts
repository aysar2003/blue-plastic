'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  employeeCreateSchema,
  employeeIdSchema,
  employeeSetActiveSchema,
  employeeUpdateSchema,
} from '@/lib/validation/employee'
import { action } from '@/server/action'
import * as employeeService from '@/server/services/employee.service'

function revalidateEmployees(id?: string) {
  revalidatePath('/employees')
  if (id) revalidatePath(`/employees/${id}`)
}

export const createEmployee = action
  .requires('hr:create')
  .input(employeeCreateSchema)
  .handler(async (ctx, input) => {
    const row = await employeeService.create(ctx, input)
    revalidateEmployees(row.id)
    return { id: row.id, name: row.name }
  })

export const updateEmployee = action
  .requires('hr:update')
  .input(employeeUpdateSchema)
  .handler(async (ctx, input) => {
    const row = await employeeService.update(ctx, input.id, input)
    revalidateEmployees(row.id)
    return { id: row.id, name: row.name }
  })

export const setEmployeeActive = action
  .requires('hr:update')
  .input(employeeSetActiveSchema)
  .handler(async (ctx, input) => {
    const row = await employeeService.setActive(ctx, input.id, input.active)
    revalidateEmployees(row.id)
    return { id: row.id, name: row.name, active: row.active }
  })

export const deleteEmployee = action
  .requires('hr:delete')
  .input(employeeIdSchema)
  .handler(async (ctx, input) => {
    await employeeService.remove(ctx, input.id)
    revalidateEmployees()
    return { id: input.id }
  })

export async function createEmployeeForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await createEmployee(formValues(formData)), 'Employee added.')
}

export async function updateEmployeeForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateEmployee(formValues(formData)), 'Employee saved.')
}
