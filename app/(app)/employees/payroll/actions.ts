'use server'

import { revalidatePath } from 'next/cache'

import {
  payrollPostSchema,
  payrollRunCreateSchema,
  payrollRunIdSchema,
  payslipAdjustmentSchema,
  payslipLineIdSchema,
} from '@/lib/validation/payroll'
import { action } from '@/server/action'
import * as payrollService from '@/server/services/payroll.service'

function revalidatePayroll(id?: string) {
  revalidatePath('/employees/payroll')
  if (id) revalidatePath(`/employees/payroll/${id}`)
}

export const createPayrollRun = action
  .requires('hr:payroll')
  .input(payrollRunCreateSchema)
  .handler(async (ctx, input) => {
    const row = await payrollService.createRun(ctx, input)
    revalidatePayroll(row.id)
    return { id: row.id }
  })

export const deletePayrollRun = action
  .requires('hr:payroll')
  .input(payrollRunIdSchema)
  .handler(async (ctx, input) => {
    await payrollService.removeRun(ctx, input.id)
    revalidatePayroll()
    return { id: input.id }
  })

export const postPayrollRun = action
  .requires('hr:payroll')
  .input(payrollPostSchema)
  .handler(async (ctx, input) => {
    const result = await payrollService.postRun(ctx, input.id, {
      payFromAccountId: input.payFromAccountId,
      date: input.date,
    })
    revalidatePayroll(input.id)
    return result
  })

export const addPayslipAdjustment = action
  .requires('hr:payroll')
  .input(payslipAdjustmentSchema)
  .handler(async (ctx, input) => {
    const run = await payrollService.addPayslipAdjustment(ctx, input)
    revalidatePayroll(run.id)
    return { id: run.id }
  })

export const removePayslipLine = action
  .requires('hr:payroll')
  .input(payslipLineIdSchema)
  .handler(async (ctx, input) => {
    const run = await payrollService.removePayslipLine(ctx, input.id)
    revalidatePayroll(run.id)
    return { id: run.id }
  })
