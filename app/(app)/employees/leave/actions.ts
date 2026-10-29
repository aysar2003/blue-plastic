'use server'

import { revalidatePath } from 'next/cache'

import {
  leaveAllocationSchema,
  leaveRequestCreateSchema,
  leaveRequestDecideSchema,
  leaveRequestIdSchema,
  leaveTypeCreateSchema,
  leaveTypeIdSchema,
  leaveTypeUpdateSchema,
} from '@/lib/validation/leave'
import { action } from '@/server/action'
import * as leaveService from '@/server/services/leave.service'

function revalidateLeave() {
  revalidatePath('/employees/leave')
  revalidatePath('/employees')
}

export const createLeaveType = action
  .requires('hr:leave')
  .input(leaveTypeCreateSchema)
  .handler(async (ctx, input) => {
    const row = await leaveService.createType(ctx, {
      name: input.name,
      paid: input.paid ?? true,
      daysPerYear: input.daysPerYear ?? '0',
      active: input.active,
    })
    revalidateLeave()
    return { id: row.id, name: row.name }
  })

export const updateLeaveType = action
  .requires('hr:leave')
  .input(leaveTypeUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await leaveService.updateType(ctx, id, {
      name: rest.name,
      paid: rest.paid ?? true,
      daysPerYear: rest.daysPerYear ?? '0',
      active: rest.active,
    })
    revalidateLeave()
    return { id: row.id }
  })

export const deleteLeaveType = action
  .requires('hr:leave')
  .input(leaveTypeIdSchema)
  .handler(async (ctx, input) => {
    const result = await leaveService.removeType(ctx, input.id)
    revalidateLeave()
    return result
  })

export const upsertLeaveAllocation = action
  .requires('hr:leave')
  .input(leaveAllocationSchema)
  .handler(async (ctx, input) => {
    const row = await leaveService.upsertAllocation(ctx, input)
    revalidateLeave()
    return { id: row.id }
  })

export const createLeaveRequest = action
  .requires('hr:leave')
  .input(leaveRequestCreateSchema)
  .handler(async (ctx, input) => {
    const row = await leaveService.createRequest(ctx, input)
    revalidateLeave()
    return { id: row.id }
  })

export const decideLeaveRequest = action
  .requires('hr:leave')
  .input(leaveRequestDecideSchema)
  .handler(async (ctx, input) => {
    const row = await leaveService.decide(ctx, input.id, input.approve, input.decisionNote)
    revalidateLeave()
    return { id: row.id, status: row.status }
  })

export const cancelLeaveRequest = action
  .requires('hr:leave')
  .input(leaveRequestIdSchema)
  .handler(async (ctx, input) => {
    const row = await leaveService.cancel(ctx, input.id)
    revalidateLeave()
    return { id: row.id }
  })
