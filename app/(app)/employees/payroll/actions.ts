'use server'

import { revalidatePath } from 'next/cache'

import {
  advanceCreateSchema,
  endOfServiceCreateSchema,
  payrollPostSchema,
  payrollRunCreateSchema,
  payrollRunIdSchema,
  payrollSettleSchema,
  payslipAdjustmentSchema,
  payslipAttendanceSchema,
  payslipIncludeSchema,
  payslipLineIdSchema,
  structureCreateSchema,
  structureRuleSchema,
  structureRuleUpdateSchema,
} from '@/lib/validation/payroll'
import { action } from '@/server/action'
import * as payrollService from '@/server/services/payroll.service'
import * as standardPayroll from '@/server/services/payroll-standard.service'

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
    return { id: row.id, warnings: row.warnings }
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
      liabilityAccountId: input.liabilityAccountId,
      payMode: input.payMode,
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

export const recomputePayrollRun = action
  .requires('hr:payroll')
  .input(payrollRunIdSchema)
  .handler(async (ctx, input) => {
    const warnings = await standardPayroll.recomputeRun(ctx, input.id)
    revalidatePayroll(input.id)
    return { id: input.id, warnings }
  })

export const submitPayrollRun = action
  .requires('hr:payroll')
  .input(payrollPostSchema)
  .handler(async (ctx, input) => {
    await standardPayroll.submitRun(ctx, input.id, input)
    revalidatePayroll(input.id)
    return { id: input.id }
  })

export const setPayslipIncluded = action
  .requires('hr:payroll')
  .input(payslipIncludeSchema)
  .handler(async (ctx, input) => {
    const runId = await standardPayroll.setIncluded(ctx, input.payslipId, input.included)
    revalidatePayroll(runId)
    return { id: runId }
  })

export const emailPayslip = action
  .requires('hr:payroll')
  .input(payslipLineIdSchema)
  .handler(async (ctx, input) => {
    const sent = await standardPayroll.emailPayslip(ctx, input.id)
    return sent
  })

export const addStructureRule = action
  .requires('hr:payroll')
  .input(structureRuleSchema)
  .handler(async (ctx, input) => {
    await standardPayroll.addStructureRule(ctx, input)
    revalidatePath('/employees/payroll/structures')
    return { id: input.structureId }
  })

export const removeStructureRule = action
  .requires('hr:payroll')
  .input(payslipLineIdSchema)
  .handler(async (ctx, input) => {
    await standardPayroll.removeStructureRule(ctx, input.id)
    revalidatePath('/employees/payroll/structures')
    return { id: input.id }
  })

export const createSalaryStructure = action
  .requires('hr:payroll')
  .input(structureCreateSchema)
  .handler(async (ctx, input) => {
    const id = await standardPayroll.createStructure(ctx, input)
    revalidatePath('/employees/payroll/structures')
    return { id }
  })

export const updateStructureRule = action
  .requires('hr:payroll')
  .input(structureRuleUpdateSchema)
  .handler(async (ctx, input) => {
    await standardPayroll.updateStructureRule(ctx, input)
    revalidatePath('/employees/payroll/structures')
    return { id: input.id }
  })

export const settlePayrollRun = action
  .requires('hr:payroll')
  .input(payrollSettleSchema)
  .handler(async (ctx, input) => {
    const result = await standardPayroll.settlePayrollRun(ctx, input.id, {
      payFromAccountId: input.payFromAccountId,
      date: input.date,
    })
    revalidatePayroll(input.id)
    return result
  })

export const setPayslipAttendance = action
  .requires('hr:payroll')
  .input(payslipAttendanceSchema)
  .handler(async (ctx, input) => {
    const runId = await standardPayroll.setPayslipAttendance(ctx, input)
    revalidatePayroll(runId)
    return { id: runId }
  })

export const createAdvance = action
  .requires('hr:payroll')
  .input(advanceCreateSchema)
  .handler(async (ctx, input) => {
    await standardPayroll.createAdvance(ctx, input)
    revalidatePath('/employees/payroll/advances')
    return { ok: true }
  })

export const closeAdvance = action
  .requires('hr:payroll')
  .input(payslipLineIdSchema)
  .handler(async (ctx, input) => {
    await standardPayroll.closeAdvance(ctx, input.id)
    revalidatePath('/employees/payroll/advances')
    return { id: input.id }
  })

export const createEndOfService = action
  .requires('hr:payroll')
  .input(endOfServiceCreateSchema)
  .handler(async (ctx, input) => {
    const row = await standardPayroll.createEndOfService(ctx, input)
    revalidatePath('/employees/payroll/gratuity')
    return row
  })

export const postEndOfService = action
  .requires('hr:payroll')
  .input(payslipLineIdSchema)
  .handler(async (ctx, input) => {
    const row = await standardPayroll.postEndOfService(ctx, input.id)
    revalidatePath('/employees/payroll/gratuity')
    return row
  })

export const deleteEndOfService = action
  .requires('hr:payroll')
  .input(payslipLineIdSchema)
  .handler(async (ctx, input) => {
    await standardPayroll.removeEndOfService(ctx, input.id)
    revalidatePath('/employees/payroll/gratuity')
    return { id: input.id }
  })
